import DescriptionOpenEntry from "@/components/description-entry/description-open-entry";
import { MAX_DELAY, MIN_DELAY } from "@/constant/app.constant";
import { addTaskTo_QueueOrder, Task_QueueOrder, taskQueueOrder } from "@/helpers/task-queue-order.helper";

import { changeLeverageHandler } from "@/helpers/change-leverage-handler.helper";
import { checkSize } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { THandleEntry } from "@/types/entry.type";
import { SymbolState } from "@/types/symbol.type";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSocket } from "./socket.hook";

export type TUseWebSocketHandler = {
    webviewRef: React.RefObject<Electron.WebviewTag | null>;
    handleOpenEntry: (payload: THandleEntry) => Promise<void>;
};

export const useWebSocketHandler = ({ webviewRef, handleOpenEntry }: TUseWebSocketHandler) => {
    const socket = useSocket();

    const isStart = useAppSelector((state) => state.bot.isStart);
    const whitelistResetInProgress = useAppSelector((state) => state.bot.whitelistResetInProgress);
    const settingSystem = useAppSelector((state) => state.bot.settingSystem);
    const SettingUsers = useAppSelector((state) => state.user.info?.SettingUsers);
    const priority = useAppSelector((state) => state.bot.priority);

    const latestRef = useRef({
        isStart,
        whitelistResetInProgress,
        settingSystem,
        SettingUsers,
        webviewRef,
        priority,
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
            handleOpenEntry,
        };
    }, [isStart, webviewRef, settingSystem, SettingUsers, whitelistResetInProgress, priority, handleOpenEntry]);

    const handleEntry = useCallback(async ({ data }: TSocketRes<SymbolState[]>) => {
        // console.log({ handleEntry: data });

        const { isStart, webviewRef, SettingUsers, whitelistResetInProgress, priority, handleOpenEntry } = latestRef.current;
        if (!isStart || whitelistResetInProgress || !webviewRef.current || !SettingUsers) return;

        const { maxTotalOpenPO, id: settingUserId, leverage: leverageNumber } = SettingUsers;

        const webview = webviewRef.current;

        for (const item of data) {
            // console.log({ "taskQueueOrder.size": taskQueueOrder.size, maxTotalOpenPO: settingBot.maxTotalOpenPO });
            const { symbol, flags } = item;
            const { entryBySettingUserId } = flags;
            const size = entryBySettingUserId[settingUserId].size;
            const isLong = entryBySettingUserId[settingUserId].isLong;
            // const isShort = entryBySettingUserId[settingUserId].isShort;

            if (taskQueueOrder.size >= maxTotalOpenPO) return;
            if (taskQueueOrder.has(symbol)) return;

            if (!checkSize(size)) return toast.error(`Size: ${size} is not valid`);

            // thay đổi đòn bẩy trước khi vào lệnh
            // nếu không thay đổi được thì không vào
            const isChangeLeverage = await changeLeverageHandler({ symbol, leverageNumber, webview });
            if (!isChangeLeverage) return;

            const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

            addTaskTo_QueueOrder(symbol, {
                symbol: symbol,
                side: isLong ? "long" : "short",
                size: size,
                delay: delay,
                createdAt: Date.now(),
                resultPosition: null,
                handle: async (task: Task_QueueOrder) => {
                    const { side, symbol, delay, size } = task;
                    const payload: THandleEntry = { webview, payload: { side, symbol, size } };
                    await handleOpenEntry(payload)
                        .then(() => {
                            const status = `Open Postion`;
                            toast.success(`[SUCCESS] ${status}`, {
                                description: <DescriptionOpenEntry symbol={symbol} size={size} delay={delay} side={side} />,
                            });
                        })
                        .catch((err) => {
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
