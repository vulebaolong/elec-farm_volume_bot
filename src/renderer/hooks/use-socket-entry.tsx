import DescriptionOpenEntry from "@/components/description-entry/description-open-entry";
import { MAX_DELAY, MIN_DELAY, STOP_LOSS, TAKE_PROFIT, TIMEOUT_POSITION } from "@/constant/app.constant";
import { addTaskTo_QueueOrder, Task_QueueOrder, taskQueueOrder } from "@/helpers/task-queue-order.helper";
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

    const settingBot = useAppSelector((state) => state.setting.settingBot);
    const poPerToken = useAppSelector((state) => state.position.poPerToken);
    const totalOpenPO = useAppSelector((state) => state.position.totalOpenPO);
    const isStart = useAppSelector((state) => state.bot.isStart);

    const latestRef = useRef({
        isStart,
        webviewRef,
        settingBot,
        poPerToken,
        totalOpenPO,
        handleOpenEntry,
    });

    useEffect(() => {
        latestRef.current = {
            isStart,
            webviewRef,
            settingBot,
            poPerToken,
            totalOpenPO,
            handleOpenEntry,
        };
    }, [isStart, webviewRef, settingBot, poPerToken, totalOpenPO, handleOpenEntry]);

    const handleEntry = useCallback(({ data }: TSocketRes<SymbolState[]>) => {
        // console.log({ handleEntry: data });
        const { isStart, webviewRef, settingBot, poPerToken, totalOpenPO, handleOpenEntry } = latestRef.current;

        // console.log({ isStart, settingBot, poPerToken, totalOpenPO });
        if (!isStart || !webviewRef.current || !settingBot || poPerToken === null || totalOpenPO === null) return;

        const webview = webviewRef.current;

        for (const item of data) {
            // console.log({ "taskQueueOrder.size": taskQueueOrder.size, maxTotalOpenPO: settingBot.maxTotalOpenPO });
            if (taskQueueOrder.size >= settingBot.maxTotalOpenPO) {
                // console.log(`taskQueueOrder size >= totalOpenPO ${taskQueueOrder.size} >= ${settingBot.maxTotalOpenPO}`);
                return;
            }
            if (taskQueueOrder.has(item.symbol)) {
                // console.log(`taskQueueOrder has ${item.symbol}`);
                return;
            }

            const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

            addTaskTo_QueueOrder(item.symbol, {
                symbol: item.symbol,
                side: item.flags.isLong ? "long" : "short",
                size: "1",
                delay: delay,
                createdAt: Date.now(),
                resultPosition: null,
                handle: async (task: Task_QueueOrder) => {
                    const { side, symbol, delay } = task;
                    const payload: THandleEntry = { webview, payload: { side, symbol, size: "1" } };
                    await handleOpenEntry(payload)
                        .then(() => {
                            const status = `Open Postion`;
                            toast.success(`[SUCCESS] ${status}`, {
                                description: (
                                    <DescriptionOpenEntry
                                        symbol={symbol}
                                        delay={delay}
                                        timeout={TIMEOUT_POSITION}
                                        side={side}
                                        tp={TAKE_PROFIT}
                                        sl={STOP_LOSS}
                                    />
                                ),
                            });
                        })
                        .catch((err) => {
                            const status = `Open Postion`;
                            toast.error(`[ERROR] ${status}`, {
                                description: (
                                    <DescriptionOpenEntry
                                        symbol={task.symbol}
                                        delay={task.delay}
                                        timeout={TIMEOUT_POSITION}
                                        side={task.side}
                                        tp={TAKE_PROFIT}
                                        sl={STOP_LOSS}
                                    />
                                ),
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
