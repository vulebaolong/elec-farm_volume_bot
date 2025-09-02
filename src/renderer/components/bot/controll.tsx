import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SET_IS_START } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { TWorkerData, TWorkerHeartbeat } from "@/types/worker.type";
import { useEffect, useState } from "react";
import { StickyPanel } from "../log-ui/sticky-panel";
import LogsPane from "../terminal-log/log-pane";
import PassiveSticky from "../terminal-log/passive-sticky";

type TProps = {};

export default function Controll({}: TProps) {
    const [isReady, setIsReady] = useState<boolean>(false);
    const isStart = useAppSelector((state) => state.bot.isStart);
    const dispatch = useAppDispatch();

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
                <CardContent className="grid gap-2">
                    <div className="grid gap-5">
                        <div className="flex gap-2 items-center h-fit">
                            <Button disabled={!isReady || isStart} onClick={start} size="sm">
                                Start
                            </Button>
                            <Button disabled={!isReady || !isStart} onClick={stop} size="sm">
                                Stop
                            </Button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <LogsPane />
                        <PassiveSticky />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
