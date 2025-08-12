import DescriptionOpenEntry from "@/components/description-entry/description-open-entry";
import { IS_PRODUCTION, MAX_DELAY, MIN_DELAY } from "@/constant/app.constant";
import { addTaskTo_QueueOrder, Task_QueueOrder, taskQueueOrder } from "@/helpers/task-queue-order.helper";

import { useAppSelector } from "@/redux/store";
import { TRespnoseGate, TSocketRes } from "@/types/base.type";
import { THandleEntry } from "@/types/entry.type";
import { SymbolState } from "@/types/symbol.type";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSocket } from "./socket.hook";
import { changedLaveragelist } from "@/helpers/white-list.helper";
import { changeLeverage } from "@/javascript-string/logic-farm";
import { checkSize } from "@/helpers/function.helper";

export type TUseWebSocketHandler = {
    webviewRef: React.RefObject<Electron.WebviewTag | null>;
    handleOpenEntry: (payload: THandleEntry) => Promise<void>;
};

export const useWebSocketHandler = ({ webviewRef, handleOpenEntry }: TUseWebSocketHandler) => {
    const socket = useSocket();

    const settingBot = useAppSelector((state) => state.setting.settingBot);
    const isStart = useAppSelector((state) => state.bot.isStart);

    const latestRef = useRef({
        isStart,
        webviewRef,
        settingBot,
        handleOpenEntry,
    });

    useEffect(() => {
        latestRef.current = {
            isStart,
            webviewRef,
            settingBot,
            handleOpenEntry,
        };
    }, [isStart, webviewRef, settingBot, handleOpenEntry]);

    const handleEntry = useCallback(async ({ data }: TSocketRes<SymbolState[]>) => {
        // console.log({ handleEntry: data });
        const { isStart, webviewRef, settingBot, handleOpenEntry } = latestRef.current;

        // console.log({ isStart, settingBot });
        if (!isStart || !webviewRef.current || !settingBot) return;

        const webview = webviewRef.current;

        for (const item of data) {
            // console.log({ "taskQueueOrder.size": taskQueueOrder.size, maxTotalOpenPO: settingBot.maxTotalOpenPO });
            if (taskQueueOrder.size >= settingBot.maxTotalOpenPO) {
                return;
            }
            if (taskQueueOrder.has(item.symbol)) {
                // console.log(`taskQueueOrder has ${item.symbol}`);
                return;
            }

            if (!checkSize(item.size)) {
                toast.error(`Size: ${item.size} is not valid`);
                return;
            }

            // thay đổi đòn bẩy trước khi vào lệnh
            // nếu không thay đổi được thì không vào
            if (!changedLaveragelist.has(item.symbol)) {
                try {
                    const leverage = settingBot.leverage.toString();
                    const stringOrder = changeLeverage({
                        symbol: item.symbol,
                        leverage: leverage,
                    });
                    const result: TRespnoseGate<any> = await webview.executeJavaScript(stringOrder);
                    console.log({ reusltne: result });

                    // Check response code
                    if (result.code !== 200) {
                        throw new Error(`Change leverage failed: ${result.message}`);
                    }

                    // Check cả 2 chiều (dual mode)
                    if (result.data?.[0]?.leverage !== leverage || result.data?.[1]?.leverage !== leverage) {
                        throw new Error(
                            `resLeverage !== settingBot.leverage: 
                                    long=${result.data?.[0]?.leverage} 
                                    short=${result.data?.[1]?.leverage} 
                                    expected=${leverage}`,
                        );
                    }

                    changedLaveragelist.add(item.symbol);
                    if (!IS_PRODUCTION) {
                        toast.success(`Change Leverage Successfully: ${item.symbol} - ${settingBot.leverage}`);
                    }
                } catch (error) {
                    console.log("Change leverage error", error);
                    toast.error(`Change Leverage Failed: ${item.symbol}`);
                    return; // ⛔ Dừng hẳn, không vào lệnh
                }
            }

            const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

            addTaskTo_QueueOrder(item.symbol, {
                symbol: item.symbol,
                side: item.flags.isLong ? "long" : "short",
                size: item.size,
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
