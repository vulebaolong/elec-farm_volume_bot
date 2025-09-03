// main/metrics.ts
import { app, ipcMain, webContents } from "electron";
import os from "os";
import { monitorEventLoopDelay } from "perf_hooks";
import v8 from "v8";

const el = monitorEventLoopDelay({ resolution: 500 });
el.enable();

function getIpcListenerCount() {
    const names = ipcMain.eventNames();
    return names.reduce((sum, n) => sum + ipcMain.listenerCount(n as any), 0);
}

export async function getMetricsSnapshot() {
    const mem = await process.getProcessMemoryInfo(); // RSS/private/shared (OS-level)
    const cpu = process.getCPUUsage(); // { percentCPUUsage, idleWakeupsPerSecond }
    const heap = process.memoryUsage(); // V8 heap (JS-level)
    const v8stats = v8.getHeapStatistics(); // chi tiết V8
    const appProcs = app.getAppMetrics(); // mọi process của app

    return {
        ts: Date.now(),
        main: {
            cpu, // cpu.percentCPUUsage ~ 0..100
            mem, // mem.private + mem.residentSet…
            heap, // heap.heapUsed, heap.heapTotal...
            v8: v8stats, // total_available_size, used_heap_size...
            eventLoop: {
                mean: el.mean / 1e6, // ms
                max: el.max / 1e6,
                p95: el.percentile(95) / 1e6,
            },
            ipcListeners: getIpcListenerCount(),
        },
        app: {
            processes: appProcs.length,
            webContents: webContents.getAllWebContents().length,
        },
        os: {
            loadavg: os.loadavg(), // 1,5,15 phút
            freemem: os.freemem(),
            totalmem: os.totalmem(),
        },
    };
}

export function registerMetricsIPC() {
    ipcMain.handle("metrics", () => getMetricsSnapshot());
}
