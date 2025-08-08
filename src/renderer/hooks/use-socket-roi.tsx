import DescriptionCloseEntry from "@/components/description-entry/description-close-entry";
import { STOP_LOSS, TAKE_PROFIT, TIMEOUT_POSITION } from "@/constant/app.constant";
import { taskQueueOrder } from "@/helpers/task-queue-order.helper";
import { TSocketRes } from "@/types/base.type";
import { THandleEntry } from "@/types/entry.type";
import { TSocketRoi } from "@/types/socket-roi.type";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSocket } from "./socket.hook";
import { useAppSelector } from "@/redux/store";

export type TUseSocketRoi = {
    webviewRef: React.RefObject<Electron.WebviewTag | null>;
    handleCloseEntry: (payload: THandleEntry) => Promise<void>;
};

export const useSocketRoi = ({ webviewRef, handleCloseEntry }: TUseSocketRoi) => {
    const socket = useSocket();
    const isStart = useAppSelector((state) => state.bot.isStart);

    const latestRef = useRef({
        isStart,
        webviewRef,
        handleCloseEntry,
    });

    useEffect(() => {
        latestRef.current = {
            isStart,
            webviewRef,
            handleCloseEntry,
        };
    }, [isStart, webviewRef, handleCloseEntry]);

    const handleRoi = useCallback(async (data: TSocketRes<TSocketRoi>) => {
        const { isStart, webviewRef, handleCloseEntry } = latestRef.current;

        if (!isStart || !webviewRef.current) return;
        console.log("ORDER", taskQueueOrder, taskQueueOrder.size);

        const webview = webviewRef.current;

        const now = Date.now();


        for (const [symbol, task] of taskQueueOrder) {
            const { resultPosition, createdAt } = task;

            if (!resultPosition) continue;

            const size = Number(resultPosition.size);
            const entryPrice = Number(resultPosition.entry_price);
            const lastPrice = data.data[symbol]?.lastPrice;
            const quanto_multiplier = data.data[symbol]?.quanto_multiplier;
            const leverage = Number(resultPosition.leverage);
            const mode = resultPosition.mode;

            // ✅ Kiểm tra dữ liệu đầu vào
            const isValidData = !!mode && size && leverage && entryPrice && lastPrice && quanto_multiplier;

            if (!isValidData) continue;

            const initialMargin = (entryPrice * Math.abs(size) * quanto_multiplier) / leverage;
            const unrealizedPnL = (lastPrice - entryPrice) * size * quanto_multiplier;
            const returnPercent = (unrealizedPnL / initialMargin) * 100;

            const isTP = returnPercent >= TAKE_PROFIT;
            const isSL = returnPercent <= -STOP_LOSS;
            const isTimeout = now - createdAt >= TIMEOUT_POSITION;

            console.log(`[${symbol}] ${returnPercent} |${TAKE_PROFIT} | ${STOP_LOSS}`);

            if (!isTP && !isSL && !isTimeout) continue; // ✅ Không thỏa mãn điều kiện nào

            const reason = isTP ? "🟢Profit" : isSL ? "🔴Loss" : "⏰Timeout";
            const side = mode === "dual_long" ? "long" : "short";

            const payload: THandleEntry = {
                webview,
                payload: {
                    size: size.toString(),
                    symbol,
                    side,
                },
            };

            console.log(`📌 Close condition met for ${symbol}: ${reason} | ${returnPercent.toFixed(2)}%`);

            await handleCloseEntry({ ...payload, flag: "roi" })
                .then(() => {
                    toast.success(`[SUCCESS] Close Position`, {
                        description: (
                            <DescriptionCloseEntry symbol={symbol} returnPercent={returnPercent} reason={reason} tp={TAKE_PROFIT} sl={STOP_LOSS} />
                        ),
                    });
                })
                .catch((err) => {
                    toast.error(`[ERROR] Close Position`, {
                        description: (
                            <DescriptionCloseEntry symbol={symbol} returnPercent={returnPercent} reason={reason} tp={TAKE_PROFIT} sl={STOP_LOSS} />
                        ),
                    });
                });
        }
    }, []);

    useEffect(() => {
        if (!socket?.socket) return;

        socket.socket.on("roi", handleRoi);
        return () => {
            socket.socket?.off("roi", handleRoi);
        };
    }, [socket?.socket, handleRoi]);
};

// {
//           "maintenance_rate": "0.03",
//           "tier": 12,
//           "initial_rate": "0.06666",
//           "leverage_max": "15",
//           "risk_limit": "100000000",
//           "deduction": "847250"
//       },

// entry: 114353
// notional = entryPrice * size * quanto_multiplier
// notional = 114353 * 1 * 0,0001 = 11,4353

// requiredMargin = notional * tier.initial_rate
// requiredMargin = 11,4353 * 0,03 = 2,28706

// requiredMargin <= available && notional <= tier.risk_limit
// 2,28706
