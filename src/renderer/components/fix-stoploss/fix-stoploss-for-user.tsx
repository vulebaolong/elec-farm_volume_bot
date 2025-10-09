import { useCreateFixStopLossHistories } from "@/api/tanstack/fix-stoploss-histories.tanstack";
import { useUpsertFixStopLoss } from "@/api/tanstack/fix-stoploss.tanstack";
import { TDataFixStopLossHistoriesReq, TUpsertFixStopLossReq } from "@/types/fix-stoploss.type";
import { TWorkerData } from "@/types/worker.type";
import { useEffect } from "react";

export default function FixStoplossForUser() {
    const upsertStopLoss = useUpsertFixStopLoss();
    const createFixStopLossHistories = useCreateFixStopLossHistories();
    useEffect(() => {
        const offFixStopLoss = window.electron.ipcRenderer.on("bot:upsertFixStopLoss", (data: TWorkerData<TUpsertFixStopLossReq>) => {
            upsertStopLoss.mutate(data.payload);
        });

        const offCreateFixStopLossHistories = window.electron.ipcRenderer.on(
            "bot:createFixStopLossHistories",
            (data: TWorkerData<TDataFixStopLossHistoriesReq>) => {
                createFixStopLossHistories.mutate(data.payload);
            },
        );

        return () => {
            offFixStopLoss?.();
            offCreateFixStopLossHistories?.();
        };
    }, [upsertStopLoss]);
    return <></>;
}
