// main/rate-ipc.ts (hoặc ngay trong file main của bạn)
import { BrowserWindow, ipcMain, shell } from "electron";
import { GateRateCounter } from "./endpoint-counter";

export function setupRateIpc(rateCounter: GateRateCounter) {
    const broadcast = (() => {
        let t: NodeJS.Timeout | null = null;
        return () => {
            if (t) return;
            t = setTimeout(() => {
                t = null;
                const snap = rateCounter.snapshot();
                for (const w of BrowserWindow.getAllWindows()) {
                    w.webContents.send("rate:counts:update", { ts: Date.now(), data: snap });
                }
            }, 200); // debounce nhẹ cho đỡ spam
        };
    })();

    // expose IPC cho UI
    ipcMain.handle("rate:counts:path", () => rateCounter.getPath());
    ipcMain.handle("rate:counts:snapshot", () => rateCounter.snapshot());
    ipcMain.handle("rate:counts:clear", async () => {
        await rateCounter.clear();
        broadcast();
        return true;
    });
    ipcMain.handle("rate:counts:reveal", async () => {
        try {
            shell.showItemInFolder(rateCounter.getPath());
        } catch {}
    });

    return { broadcast };
}
