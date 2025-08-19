import DescriptionCloseEntry from "@/components/description-entry/description-close-entry";
import { taskQueueOrder } from "@/helpers/task-queue-order.helper";
import { changedLaveragelist } from "@/helpers/white-list.helper";
import { useAppSelector } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { TSocketRoi } from "@/types/socket-roi.type";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSocket } from "./socket.hook";
import { THandleCloseEntry } from "@/types/entry.type";

export type TUseSocketRoi = {
    webviewRef: React.RefObject<Electron.WebviewTag | null>;
    handleCloseEntry: (payload: THandleCloseEntry) => Promise<void>;
};

export const useSocketRoi = ({ webviewRef, handleCloseEntry }: TUseSocketRoi) => {
    const socket = useSocket();

    const isStart = useAppSelector((state) => state.bot.isStart);
    const whitelistResetInProgress = useAppSelector((state) => state.bot.whitelistResetInProgress);
    const takeProfit = useAppSelector((state) => state.user.info?.SettingUsers.takeProfit); // ví dụ: 0.5 (số)
    const stopLoss = useAppSelector((state) => state.user.info?.SettingUsers.stopLoss);
    const timeoutMs = useAppSelector((state) => state.user.info?.SettingUsers.timeoutMs);
    const timeoutEnabled = useAppSelector((state) => state.user.info?.SettingUsers.timeoutEnabled);
    const uiSelector = useAppSelector((state) => state.bot.uiSelector);

    const latestRef = useRef({
        isStart,
        whitelistResetInProgress,
        webviewRef,
        takeProfit,
        stopLoss,
        timeoutMs,
        timeoutEnabled,
        uiSelector,
        handleCloseEntry,
    });

    useEffect(() => {
        latestRef.current = {
            isStart,
            whitelistResetInProgress,
            webviewRef,
            takeProfit,
            stopLoss,
            timeoutMs,
            timeoutEnabled,
            uiSelector,
            handleCloseEntry,
        };
    }, [isStart, whitelistResetInProgress, webviewRef, takeProfit, stopLoss, timeoutMs, timeoutEnabled, uiSelector, handleCloseEntry]);

    const handleRoi = useCallback(async (data: TSocketRes<TSocketRoi>) => {
        const { isStart, whitelistResetInProgress, webviewRef, takeProfit, stopLoss, timeoutMs, timeoutEnabled, uiSelector, handleCloseEntry } =
            latestRef.current;

        // console.log("handleRoi", {
        //     taskQueueOrder: Array.from(taskQueueOrder.entries()),
        //     "taskQueueOrder.size": taskQueueOrder.size,
        //     changedLaveragelist,
        //     takeProfit,
        //     stopLoss,
        //     timeoutMs,
        //     timeoutEnabled,
        // });

        if (!isStart || whitelistResetInProgress || !webviewRef.current) return;

        const selectorWrapperPositionBlocks = uiSelector?.find((item) => item.code === "wrapperPositionBlocks")?.selectorValue;
        const selectorbuttonTabPosition = uiSelector?.find((item) => item.code === "buttonTabPosition")?.selectorValue;
        if (!selectorWrapperPositionBlocks || !selectorbuttonTabPosition) {
            console.log(`Not found selector`, { selectorWrapperPositionBlocks, selectorbuttonTabPosition });
            return;
        }

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
            // console.log({ mode, size, leverage, entryPrice, lastPrice, quanto_multiplier });
            if (!mode) continue;
            if (!size || size === null || size === undefined) continue;
            if (leverage === null || leverage === undefined) continue;
            if (entryPrice === null || entryPrice === undefined) continue;
            if (lastPrice === null || lastPrice === undefined) continue;
            if (!quanto_multiplier) continue;

            const initialMargin = (entryPrice * Math.abs(size) * quanto_multiplier) / leverage;
            const unrealizedPnL = (lastPrice - entryPrice) * size * quanto_multiplier;
            const returnPercent = (unrealizedPnL / initialMargin) * 100;

            // const isTP = returnPercent >= takeProfit;
            const isSL = returnPercent <= -stopLoss;
            const timedOut = timeoutEnabled ? now - createdAt >= timeoutMs : false; // ✅ chỉ check khi bật

            console.log(`[${symbol}] ${returnPercent} |${takeProfit} | ${stopLoss}`);

            // if (!isTP && !isSL && !timedOut) continue; // ✅ Không thỏa mãn điều kiện nào
            if (!isSL && !timedOut) continue; // ✅ Không thỏa mãn điều kiện nào

            const reason = isSL ? "🔴Loss" : `⏰Timeout - ${timeoutMs}`;
            const side = mode === "dual_long" ? "long" : "short";

            const payload: THandleCloseEntry = {
                webview,
                payload: {
                    size: size.toString(),
                    symbol,
                    side,
                },
                selector: {
                    wrapperPositionBlocks: selectorWrapperPositionBlocks,
                    buttonTabPosition: selectorbuttonTabPosition,
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
