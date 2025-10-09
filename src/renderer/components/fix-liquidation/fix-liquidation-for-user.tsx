import { useUpsertFixLiquidation } from "@/api/tanstack/fix-liquidation.tanstack";
import { TUpsertFixLiquidationReq } from "@/types/fix-liquidation.type";
import { TWorkerData } from "@/types/worker.type";
import { useEffect } from "react";

export default function FixLiquidationForUser() {
    const upsertFixLiquidation = useUpsertFixLiquidation();
    useEffect(() => {
        const offFixLiquidation = window.electron.ipcRenderer.on("bot:upsertFixLiquidation", (data: TWorkerData<TUpsertFixLiquidationReq>) => {
            upsertFixLiquidation.mutate(data.payload);
        });
        return () => offFixLiquidation?.();
    }, [upsertFixLiquidation]);
    return <></>;
}
