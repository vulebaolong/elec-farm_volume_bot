import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SET_IS_START } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { TWorkerData, TWorkerHeartbeat } from "@/types/worker.type";
import { useEffect, useState } from "react";
import { StickyPanel } from "../log-ui/sticky-panel";
import LogsPane from "../terminal-log/log-pane";
import PassiveSticky from "../terminal-log/passive-sticky";
import { Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type TProps = {};

export default function Controll({}: TProps) {
    const [isReady, setIsReady] = useState<boolean>(false);
    const isStart = useAppSelector((state) => state.bot.isStart);
    const dispatch = useAppDispatch();
    const [ripples, setRipples] = useState<number[]>([]);

    const start = () => window.electron?.ipcRenderer.sendMessage("bot:start");
    const stop = () => window.electron?.ipcRenderer.sendMessage("bot:stop");

    useEffect(() => {
        const offBotIsReady = window.electron.ipcRenderer.on("bot:isReady", (data: TWorkerData<{ isReady: boolean }>) => {
            setIsReady(data.payload.isReady);
        });

        const offBotHearbeat = window.electron.ipcRenderer.on("bot:heartbeat", (data: TWorkerData<TWorkerHeartbeat>) => {
            if (isReady && isStart) {
                const id = Date.now();
                setRipples((prev) => [...prev, id]);
                // dọn ripple sau khi kết thúc animation (match với duration ~600ms)
                setTimeout(() => {
                    setRipples((prev) => prev.filter((x) => x !== id));
                }, 700);
            }
        });

        const offBotStart = window.electron.ipcRenderer.on("bot:start", (data: TWorkerData<{ isStart: boolean }>) => {
            dispatch(SET_IS_START(data.payload.isStart));
        });

        const offBotStop = window.electron.ipcRenderer.on("bot:stop", (data: TWorkerData<{ isStart: boolean }>) => {
            dispatch(SET_IS_START(data.payload.isStart));
        });

        return () => {
            offBotIsReady();
            offBotHearbeat();
            offBotStart();
            offBotStop();
        };
    }, [isReady, isStart, dispatch]);

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
                                disabled={!isReady || isStart}
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
                                <div className={cn("pulse-dot w-[10px] h-[10px]", isReady && isStart ? "bg-green-400" : "bg-green-500")}>
                                    {ripples.map((id) => (
                                        <div key={id} className="pulse-ring bg-green-500" style={{ width: `20px`, height: `20px` }} />
                                    ))}
                                </div>
                            </Button>

                            {/* STOP */}
                            <Button
                                size="sm"
                                disabled={!isReady || !isStart}
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
