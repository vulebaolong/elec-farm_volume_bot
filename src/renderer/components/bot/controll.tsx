import { useUpsertAccount } from "@/api/tanstack/account.tanstack";
import { useCreateTakeProfitAccount, useUpdateTakeProfitAccount } from "@/api/tanstack/takeprofit-account.tanstack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountEquity } from "@/helpers/function.helper";
import { ADD_RIPPLE, SET_IS_RUNNING, SET_IS_START } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { TAccount } from "@/types/account.type";
import { TCreateTakeprofitAccountReq, TTakeprofitAccount } from "@/types/takeprofit-account.type";
import { TWorkerData, TWorkerHeartbeat } from "@/types/worker.type";
import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { Play, RefreshCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Ripple from "./ripple";

type TProps = {};

export default function Controll({}: TProps) {
    const isStart = useAppSelector((state) => state.bot.isStart);
    const isRunning = useAppSelector((state) => state.bot.isRunning);
    const isChildView = useAppSelector((state) => state.bot.isChildView);
    const info = useAppSelector((state) => state.user.info);
    const dispatch = useAppDispatch();
    const [loadingReloadWebContent, setLoadingReloadWebContent] = useState(false);
    const accountRef = useRef<TAccount | null>(null);
    const takeprofitAccountNewRef = useRef<TTakeprofitAccount | null>(null);
    const createTakeProfitAccount = useCreateTakeProfitAccount();
    const updateTakeProfitAccount = useUpdateTakeProfitAccount();
    const upsertAccount = useUpsertAccount();

    const start = () => {
        window.electron?.ipcRenderer.sendMessage("bot:start");
    };
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

        const offBotSaveAccount = window.electron.ipcRenderer.on("bot:saveAccount", (data: TWorkerData<TAccount[]>) => {
            upsertAccount.mutate({
                data: data.payload,
            });

            accountRef.current = data.payload[0];
            if (takeprofitAccountNewRef.current) {
                const total = data.payload[0].total;
                const unrealised_pnl = data.payload[0].unrealised_pnl;
                const newTotal = accountEquity(total, unrealised_pnl);

                updateTakeProfitAccount.mutate({
                    id: takeprofitAccountNewRef.current.id,
                    data: {
                        newTotal: newTotal,
                    },
                });
            }
        });

        const offBotStart = window.electron.ipcRenderer.on(
            "bot:start",
            async (dataWorker: TWorkerData<{ isStart: boolean; isNextPhase: boolean }>) => {
                if (dataWorker.payload.isNextPhase) {
                    if (!accountRef.current) {
                        toast.error("Please save account first");
                        return;
                    }

                    const totalCurrent = accountRef.current.total;
                    const unrealised_pnl = accountRef.current.unrealised_pnl;
                    const total = accountEquity(totalCurrent, unrealised_pnl);

                    const payload: TCreateTakeprofitAccountReq = {
                        newTotal: total,
                        oldTotal: total,
                        source: "gate",
                        uid: accountRef.current.user,
                    };

                    await createTakeProfitAccount.mutateAsync(payload, {
                        onSuccess: (data) => {
                            takeprofitAccountNewRef.current = data.data;
                        },
                    });
                }

                dispatch(SET_IS_START(dataWorker.payload.isStart));
            },
        );

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
            offBotSaveAccount();
        };
    }, [isRunning, isStart, dispatch]);

    const isEmptyUids = info?.Uids?.length === 0

    return (
        <div className="sticky top-0 z-20">
            <Paper radius="md" withBorder p="md">
                <Stack>
                    <Group>
                        <Text fw={600}>Controll</Text>
                        <Ripple />
                    </Group>

                    <Stack>
                        <Group className="flex gap-2 items-center h-fit">
                            {/* START */}
                            <Button
                                size={"xs"}
                                disabled={!isRunning || isStart || isEmptyUids}
                                onClick={start}
                                color="green"
                                radius={"md"}
                                leftSection={<Play size={14} />}
                            >
                                Start
                            </Button>

                            {/* STOP */}
                            <Button
                                size={"xs"}
                                radius={"md"}
                                color="red"
                                disabled={!isRunning || !isStart}
                                onClick={stop}
                                leftSection={<Square size={14} />}
                                variant="light"
                            >
                                Stop
                            </Button>
                        </Group>
                        <Group>
                            {/* Reload Web */}
                            <Button
                                size={"xs"}
                                radius={"md"}
                                variant="default"
                                loading={loadingReloadWebContent}
                                className="w-[100px]"
                                onClick={reloadWebContentsView}
                                leftSection={<RefreshCcw size={14} />}
                                disabled={!isRunning}
                            >
                                Reload Web
                            </Button>

                            {/* Toggle Web */}
                            <Button
                                size={"xs"}
                                radius={"md"}
                                variant="default"
                                onClick={() => {
                                    window.electron?.ipcRenderer.sendMessage("worker:toggleWebView", { uid: 31674740 });
                                }}
                            >
                                {isChildView ? "Close Web" : "Open Web"}
                            </Button>
                        </Group>
                    </Stack>
                </Stack>
            </Paper>
        </div>
    );
}
