import { TWorkerData } from "@/types/worker.type";
import { useEffect, useState } from "react";

// types khớp payload worker đang gửi
export type TWorkerMetrics = {
    threadId: number;
    ts: number;
    heapUsed: number;
    heapTotal: number;
    v8: any;
    eventLoop: { mean: number; max: number; p95: number; utilization: number };
    cpu: { approxFromELU: number; processPct: number };
};

export default function WorkerMetrics() {
    const [m, setM] = useState<TWorkerMetrics | null>(null);

    useEffect(() => {
        const off = window.electron.ipcRenderer.on("bot:metrics", (data: TWorkerData<TWorkerMetrics>) => setM(data.payload));
        return () => off();
    }, []);

    if (!m) {
        return <p className="text-xs text-muted-foreground">Collecting worker metrics…</p>;
    }

    const heapMb = (m.heapUsed / (1024 * 1024)).toFixed(1);
    const cpuWorker = Math.min(100, Math.max(0, m.cpu?.approxFromELU ?? 0));
    const cpuProcess = Math.min(100, Math.max(0, m.cpu?.processPct ?? 0));
    const lagP95 = (m.eventLoop?.p95 ?? 0).toFixed(2);
    const elu = (m.eventLoop?.utilization ?? 0).toFixed(2); // 0..1

    return (
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-foreground/80">{m.threadId}</span>
            <span>
                CPU (bot): <span className="text-foreground">{cpuWorker}%</span>
            </span>
            <span>CPU (process): {cpuProcess}%</span>
            <span>Heap: {heapMb} MB</span>
            <span>Loop p95: {lagP95} ms</span>
        </div>
    );
}
