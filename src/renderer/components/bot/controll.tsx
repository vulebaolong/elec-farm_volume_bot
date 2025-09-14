import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADD_RIPPLE, SET_IS_RUNNING, SET_IS_START } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { TWorkerData, TWorkerHeartbeat } from "@/types/worker.type";
import { Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import Log from "../log/log";
import PassiveSticky from "../log/terminal-log/passive-sticky";
import RateCountsPanel from "../rate-counts-panel/RateCountsPanel";
import { ButtonLoading } from "../ui/button-loading";
import { useToggleDevTool } from "@/api/tanstack/devtool.tanstack";

type TProps = {};

export default function Controll({}: TProps) {
    const isStart = useAppSelector((state) => state.bot.isStart);
    const isRunning = useAppSelector((state) => state.bot.isRunning);
    const dispatch = useAppDispatch();
    const [loadingReloadWebContent, setLoadingReloadWebContent] = useState(false);
    const toggleDevTool = useToggleDevTool();

    const start = () => window.electron?.ipcRenderer.sendMessage("bot:start");
    const stop = () => window.electron?.ipcRenderer.sendMessage("bot:stop");
    const reloadWebContentsView = () => {
        window.electron?.ipcRenderer.sendMessage("bot:reloadWebContentsView");
        setLoadingReloadWebContent(true);
    };

    useEffect(() => {
        const offBotHearbeat = window.electron.ipcRenderer.on("bot:heartbeat", (data: TWorkerData<TWorkerHeartbeat>) => {
            dispatch(SET_IS_START(data.payload.isStart));
            dispatch(SET_IS_RUNNING(data.payload.isRunning));
            dispatch(ADD_RIPPLE(undefined));
        });

        const offBotStart = window.electron.ipcRenderer.on("bot:start", (data: TWorkerData<{ isStart: boolean }>) => {
            dispatch(SET_IS_START(data.payload.isStart));
        });

        const offBotStop = window.electron.ipcRenderer.on("bot:stop", (data: TWorkerData<{ isStart: boolean }>) => {
            dispatch(SET_IS_START(data.payload.isStart));
        });

        const offReloadWebContentsView = window.electron.ipcRenderer.on("bot:reloadWebContentsView", (data: TWorkerData<{ isStart: boolean }>) => {
            setLoadingReloadWebContent(false);
        });

        return () => {
            offBotHearbeat();
            offBotStart();
            offBotStop();
            offReloadWebContentsView();
        };
    }, [isRunning, isStart, dispatch]);

    return (
        <div className="px-5 sticky top-0 z-[1]">
            <Card>
                <CardHeader className="flex items-center gap-2">
                    <CardTitle className="text-base">Controll</CardTitle>
                </CardHeader>

                <CardContent className="grid gap-2">
                    <div className="grid gap-5">
                        <div className="flex gap-2 items-center h-fit">
                            {/* START */}
                            <Button
                                size="sm"
                                disabled={!isRunning || isStart}
                                onClick={start}
                                className={[
                                    "group relative h-9 rounded-xl px-3",
                                    "text-white shadow-sm transition-all",
                                    "bg-gradient-to-br from-emerald-500 to-emerald-600",
                                    "hover:shadow-md hover:from-emerald-500 hover:to-emerald-700",
                                    "!opacity-100 disabled:shadow-none",
                                    "disabled:from-emerald-900/30 disabled:to-emerald-900/50 disabled:text-emerald-200/50",
                                ].join(" ")}
                            >
                                <Play className="h-4 w-4" />
                                Start
                            </Button>

                            {/* STOP */}
                            <Button
                                size="sm"
                                disabled={!isRunning || !isStart}
                                onClick={stop}
                                className={[
                                    "group relative h-9 rounded-xl px-3",
                                    "text-white shadow-sm transition-all",
                                    "bg-gradient-to-br from-rose-500 to-rose-600",
                                    "hover:shadow-md hover:from-rose-500 hover:to-rose-700",
                                    "disabled:opacity-60 disabled:shadow-none",
                                    "disabled:from-rose-800/30 disabled:to-rose-900/30 disabled:text-rose-200/70",
                                ].join(" ")}
                            >
                                <Square className="h-4 w-4" />
                                Stop
                            </Button>

                            {/* Reload Web */}
                            <ButtonLoading
                                loading={loadingReloadWebContent}
                                className="w-[100px]"
                                variant={"outline"}
                                size="sm"
                                onClick={reloadWebContentsView}
                            >
                                Reload Web
                            </ButtonLoading>

                            {/* Devtool */}
                            <ButtonLoading
                                loading={toggleDevTool.isPending}
                                className="w-[100px]"
                                variant={"outline"}
                                size="sm"
                                onClick={() => {
                                    toggleDevTool.mutate();
                                }}
                            >
                                {!toggleDevTool?.data ? "Open" : "Close"} Devtool
                            </ButtonLoading>
                        </div>
                    </div>

                    <div className="grid gap-5">
                        <Log />
                        <PassiveSticky />
                        <RateCountsPanel />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
