import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SET_IS_START } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { toast } from "sonner";
import { StickyPanel } from "../log-ui/sticky-panel";
import { TerminalPanel } from "../log-ui/terminal-panel";
import { Bot } from "./logic/class-bot";
import { useEffect, useState } from "react";
import { TWorkerData, TWorkerHeartbeat, TWorkerMetrics } from "@/types/worker.type";

type TProps = {};

export default function Controll({}: TProps) {
    const [isReady, setIsReady] = useState<boolean>(false);
    const isStart = useAppSelector((state) => state.bot.isStart);
    const uiSelector = useAppSelector((state) => state.bot.uiSelector);
    const dispatch = useAppDispatch();
    const [botMetrics, setBotMetrics] = useState<TWorkerMetrics | null>(null);

    const start = () => {
        window.electron?.ipcRenderer.sendMessage("bot:start");
    };

    const stop = () => {
        window.electron?.ipcRenderer.sendMessage("bot:stop");
    };

    useEffect(() => {
        const offBotIsReady = window.electron.ipcRenderer.on("bot:isReady", (data: TWorkerData<{ isReady: boolean }>) => {
            console.log({ "bot:isReady": data });
            setIsReady(data.payload.isReady);
        });

        const offBotHearbeat = window.electron.ipcRenderer.on("bot:heartbeat", (data: TWorkerData<TWorkerHeartbeat>) => {
            console.log({ "bot:heartbeat": data });
        });

        const offBotMetrics = window.electron.ipcRenderer.on("bot:metrics", (data: TWorkerData<TWorkerMetrics>) => {
            // console.log({ "bot:metrics": data });
            setBotMetrics(data.payload);
        });

        const offBotStart = window.electron.ipcRenderer.on("bot:start", (data: TWorkerData<{ isStart: boolean }>) => {
            console.log({ "bot:start": data });
            dispatch(SET_IS_START(data.payload.isStart));
        });

        const offBotStop = window.electron.ipcRenderer.on("bot:stop", (data: TWorkerData<{ isStart: boolean }>) => {
            console.log({ "bot:stop": data });
            dispatch(SET_IS_START(data.payload.isStart));
        });

        return () => {
            offBotIsReady();
            offBotHearbeat();
            offBotMetrics();
            offBotStart();
            offBotStop();
        };
    }, []);

    return (
        <div className="px-5 sticky top-0 z-[1]">
            <Card>
                <CardHeader className="flex items-center gap-2">
                    <CardTitle className="text-base">Controll</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <div className="grid gap-5">
                        <div className="flex gap-2 items-center h-fit">
                            <Button disabled={!isReady || isStart} onClick={start} size="sm">
                                Start
                            </Button>
                            <Button disabled={!isReady || !isStart} onClick={stop} size="sm">
                                Stop
                            </Button>
                        </div>
                        {botMetrics && (
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle>Worker (thread {botMetrics.threadId})</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-muted-foreground">Heap (JS):</div>
                                        <div className="font-medium">{(botMetrics.heapUsed / (1024 * 1024)).toFixed(1)} MB</div>
                                    </div>
                                    <div className="text-sm">Loop p95: {botMetrics.eventLoop.p95.toFixed(2)} ms</div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    <TerminalPanel />
                    <StickyPanel />
                </CardContent>
            </Card>
        </div>
    );
}
