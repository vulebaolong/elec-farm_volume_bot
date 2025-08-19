import DescriptionOpenEntry from "@/components/description-entry/description-open-entry";
import { MAX_DELAY, MIN_DELAY } from "@/constant/app.constant";
import { addTaskTo_QueueOrder, Task_QueueOrder, taskQueueOrder } from "@/helpers/task-queue-order.helper";

import { changeLeverageHandler } from "@/helpers/change-leverage-handler.helper";
import { checkSize, computePostOnlyPrice } from "@/helpers/function.helper";
import { closeOrderMap, openOrderMap } from "@/helpers/order-map";
import { pickSideByPriority } from "@/helpers/priority-24h-change-handle";
import { useAppSelector } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { THandleOpenPostOnlyEntry } from "@/types/entry.type";
import { TPriority } from "@/types/priority-change.type";
import { SymbolState } from "@/types/symbol.type";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSocket } from "./socket.hook";

export type TUseWebSocketHandler = {
    webviewRef: React.RefObject<Electron.WebviewTag | null>;
    // handleOpenEntry: (payload: THandleOpenEntry) => Promise<void>;
    handleOpenEntry: (payload: THandleOpenPostOnlyEntry) => Promise<void>;
};

export const useWebSocketHandler = ({ webviewRef, handleOpenEntry }: TUseWebSocketHandler) => {
    const socket = useSocket();

    const isStart = useAppSelector((state) => state.bot.isStart);
    const whitelistResetInProgress = useAppSelector((state) => state.bot.whitelistResetInProgress);
    const settingSystem = useAppSelector((state) => state.bot.settingSystem);
    const SettingUsers = useAppSelector((state) => state.user.info?.SettingUsers);
    const priority = useAppSelector((state) => state.bot.priority);
    const uiSelector = useAppSelector((state) => state.bot.uiSelector);

    const latestRef = useRef({
        isStart,
        whitelistResetInProgress,
        settingSystem,
        SettingUsers,
        webviewRef,
        priority,
        uiSelector,
        handleOpenEntry,
    });

    useEffect(() => {
        latestRef.current = {
            isStart,
            whitelistResetInProgress,
            settingSystem,
            SettingUsers,
            webviewRef,
            priority,
            uiSelector,
            handleOpenEntry,
        };
    }, [isStart, webviewRef, settingSystem, SettingUsers, whitelistResetInProgress, priority, uiSelector, handleOpenEntry]);

    const handleEntry = useCallback(async ({ data }: TSocketRes<SymbolState[]>) => {
        console.log({ handleEntry: data, taskQueueOrder, openOrderMap, closeOrderMap });

        const { isStart, webviewRef, SettingUsers, whitelistResetInProgress, priority, uiSelector, handleOpenEntry } = latestRef.current;
        if (!isStart || whitelistResetInProgress || !webviewRef.current || !SettingUsers) {
            console.log(`Input Invalid`, { isStart, whitelistResetInProgress, webviewRef, SettingUsers });
            return;
        }

        const selectorInputPosition = uiSelector?.find((item) => item.code === "inputPosition")?.selectorValue;
        const selectorInputPrice = uiSelector?.find((item) => item.code === "inputPrice")?.selectorValue;
        const selectorButtonLong = uiSelector?.find((item) => item.code === "buttonLong")?.selectorValue;
        if (!selectorInputPosition || !selectorButtonLong || !selectorInputPrice) {
            console.log(`Not found selector`, { selectorInputPosition, selectorButtonLong, selectorInputPrice });
            return;
        }

        const { maxTotalOpenPO, id: settingUserId, leverage: leverageNumber } = SettingUsers;
        const webview = webviewRef.current;

        for (const item of data) {
            const { symbol, flags } = item;
            const spec = flags?.entryBySettingUserId?.[settingUserId];
            if (!spec) {
                console.log(`Can't find spec for ${symbol}`);
                continue;
            }

            const { size, isLong, isShort } = spec;

            // Ưu tiên/lọc theo priority
            const side = pickSideByPriority(isLong, isShort, priority as TPriority);
            if (!side) {
                // không phù hợp priority -> bỏ
                continue;
            }

            // Giới hạn hàng đợi
            if (taskQueueOrder.size >= maxTotalOpenPO) {
                // đã full, ngừng thêm
                console.log(`Queue order is full: ${taskQueueOrder.size} >= ${maxTotalOpenPO}`);
                break;
            }
            if (taskQueueOrder.has(symbol)) {
                console.log(`Queue order has symbol: ${symbol}`);
                continue;
            }

            if (!checkSize(size)) {
                toast.error(`Size: ${size} is not valid`);
                continue;
            }

            // Đổi leverage trước khi vào lệnh
            const ok = await changeLeverageHandler({ symbol, leverageNumber, webview });
            if (!ok) continue;

            const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

            addTaskTo_QueueOrder(symbol, {
                symbol: symbol,
                side,
                size: size,
                delay: delay,
                createdAt: Date.now(),
                resultPosition: null,
                handle: async (task: Task_QueueOrder) => {
                    const { side, symbol, delay, size } = task;

                    const priceStr = computePostOnlyPrice(side, item, 1);

                    console.log({
                        symbol,
                        askBest: item.askBest,
                        bidBest: item.bidBest,
                        orderPriceRound: item.orderPriceRound,
                        price: priceStr,
                    });

                    const payload: THandleOpenPostOnlyEntry = {
                        webview,
                        payload: {
                            side,
                            symbol,
                            size: side === "long" ? size : `-${size}`,
                            price: priceStr,
                            reduce_only: false,
                        },
                        selector: {
                            inputPosition: selectorInputPosition,
                            inputPrice: selectorInputPrice,
                            buttonLong: selectorButtonLong,
                        },
                    };
                    await handleOpenEntry(payload)
                        .then(() => {
                            const status = `Open Postion`;
                            toast.success(`[SUCCESS] ${status}`, {
                                description: <DescriptionOpenEntry symbol={symbol} size={size} delay={delay} side={side} />,
                            });
                        })
                        .catch((err) => {
                            console.log({ err });
                            const status = `Open Postion`;
                            toast.error(`[ERROR] ${status}`, {
                                description: <DescriptionOpenEntry symbol={task.symbol} size={size} delay={task.delay} side={task.side} />,
                            });
                        });
                },
            });
        }
    }, []);

    useEffect(() => {
        if (!socket?.socket) return;

        socket.socket.on("entry", handleEntry);

        return () => {
            socket.socket?.off("entry", handleEntry);
        };
    }, [socket?.socket, handleEntry]);
};
