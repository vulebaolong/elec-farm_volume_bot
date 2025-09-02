import { TWorkerData, TWorkerMetrics } from "@/types/worker.type";
import { useEffect, useState } from "react";

export default function WorkerMetrics() {
    const [botMetrics, setBotMetrics] = useState<TWorkerMetrics | null>(null);

    useEffect(() => {
        const offBotMetrics = window.electron.ipcRenderer.on("bot:metrics", (data: TWorkerData<TWorkerMetrics>) => {
            // console.log({ "bot:metrics": data });
            setBotMetrics(data.payload);
        });

        return () => {
            offBotMetrics();
        };
    }, []);

    return (
        <p className="text-xs text-muted-foreground">
            Thread Id: {botMetrics?.threadId} | Heap (JS): {((botMetrics?.heapUsed || 0) / (1024 * 1024)).toFixed(1)} MB | Loop p95:{" "}
            {botMetrics?.eventLoop.p95.toFixed(2)} ms
        </p>
    );
}
