import DescriptionCloseEntry from "@/components/description-entry/description-close-entry";
import { taskQueueOrder } from "@/helpers/task-queue-order.helper";
import { useAppSelector } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { THandleEntry } from "@/types/entry.type";
import { TSocketRoi } from "@/types/socket-roi.type";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSocket } from "./socket.hook";

export type TUseSocketRoi = {
    webviewRef: React.RefObject<Electron.WebviewTag | null>;
    handleCloseEntry: (payload: THandleEntry) => Promise<void>;
};

export const useSocketRoi = ({ webviewRef, handleCloseEntry }: TUseSocketRoi) => {
    const socket = useSocket();

    const isStart = useAppSelector((state) => state.bot.isStart);
    const takeProfit = useAppSelector((state) => state.setting.settingBot?.takeProfit); // ví dụ: 0.5 (số)
    const stopLoss = useAppSelector((state) => state.setting.settingBot?.stopLoss);
    const timeoutMs = useAppSelector((state) => state.setting.settingBot?.timeoutMs);
    const timeoutEnabled = useAppSelector((state) => state.setting.settingBot?.timeoutEnabled);

    const latestRef = useRef({
        isStart,
        webviewRef,
        takeProfit,
        stopLoss,
        timeoutMs,
        timeoutEnabled,
        handleCloseEntry,
    });

    useEffect(() => {
        latestRef.current = {
            isStart,
            webviewRef,
            takeProfit,
            stopLoss,
            timeoutMs,
            timeoutEnabled,
            handleCloseEntry,
        };
    }, [isStart, webviewRef, takeProfit, stopLoss, timeoutMs, timeoutEnabled, handleCloseEntry]);

    const handleRoi = useCallback(async (data: TSocketRes<TSocketRoi>) => {
        const { isStart, webviewRef, takeProfit, stopLoss, timeoutMs, timeoutEnabled, handleCloseEntry } = latestRef.current;

        console.log("handleRoi", { taskQueueOrder, "taskQueueOrder.size": taskQueueOrder.size, takeProfit, stopLoss, timeoutMs, timeoutEnabled });
        if (!isStart || !webviewRef.current) return;

        if (
            takeProfit == null ||
            takeProfit == undefined ||
            stopLoss == null ||
            stopLoss == undefined ||
            timeoutMs == null ||
            timeoutMs == undefined ||
            timeoutEnabled == null ||
            timeoutEnabled == undefined
        ) {
            return;
        }

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

            console.log({ isValidData, symbol, mode, size, leverage, entryPrice, lastPrice, quanto_multiplier });

            if (!isValidData) continue;

            const initialMargin = (entryPrice * Math.abs(size) * quanto_multiplier) / leverage;
            const unrealizedPnL = (lastPrice - entryPrice) * size * quanto_multiplier;
            const returnPercent = (unrealizedPnL / initialMargin) * 100;

            const isTP = returnPercent >= takeProfit;
            const isSL = returnPercent <= -stopLoss;
            const timedOut = timeoutEnabled ? now - createdAt >= timeoutMs : false; // ✅ chỉ check khi bật

            console.log(`[${symbol}] ${returnPercent} |${takeProfit} | ${stopLoss}`);

            if (!isTP && !isSL && !timedOut) continue; // ✅ Không thỏa mãn điều kiện nào

            const reason = isTP ? "🟢Profit" : isSL ? "🔴Loss" : `⏰Timeout - ${timeoutMs}`;
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
                            <DescriptionCloseEntry symbol={symbol} returnPercent={returnPercent} reason={reason} tp={takeProfit} sl={stopLoss} />
                        ),
                    });
                })
                .catch((err) => {
                    toast.error(`[ERROR] Close Position`, {
                        description: (
                            <DescriptionCloseEntry symbol={symbol} returnPercent={returnPercent} reason={reason} tp={takeProfit} sl={stopLoss} />
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
