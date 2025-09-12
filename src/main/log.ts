import { app, BrowserWindow, ipcMain, shell } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import log from "electron-log/main";
import path from "node:path";

export function initLog() {
    log.initialize();
    // (tuỳ chọn) cấu hình mức log
    // main → renderer qua IPC để bạn thấy log main trong DevTools của renderer.
    // error < warn < info < verbose < debug < silly
    log.transports.file.level = "silly";
    log.transports.ipc.level = "silly";
    log.errorHandler.startCatching();
    log.eventLogger.startLogging();

    const fileInfo = () => log.transports.file.getFile(); // { path, size, ... }
    // --- IPC: path / size / read / clear / reveal ---
    ipcMain.handle("logs:path", () => fileInfo().path);

    ipcMain.handle("logs:size", () => fileInfo().size ?? 0);

    ipcMain.handle("logs:read", async () => {
        try {
            return await fsp.readFile(fileInfo().path, "utf8");
        } catch {
            return "";
        }
    });

    ipcMain.handle("logs:clear", async () => {
        try {
            const fp = fileInfo().path;
            await fsp.mkdir(path.dirname(fp), { recursive: true });
            await fsp.writeFile(fp, ""); // truncate
            return true;
        } catch {
            return false;
        }
    });

    ipcMain.handle("logs:reveal", async () => {
        try {
            shell.showItemInFolder(fileInfo().path);
        } catch {}
    });

    // --- Broadcast từng dòng log sang renderer để "tail" realtime ---
    const fmt = (m: any) => {
        const s = (v: any) =>
            typeof v === "string"
                ? v
                : (() => {
                      try {
                          return JSON.stringify(v);
                      } catch {
                          return String(v);
                      }
                  })();
        return `[${m.date.toISOString()}] [${m.level.toUpperCase()}] ${m.data.map(s).join(" ")}`;
    };
    log.hooks.push((msg) => {
        const line = fmt(msg);
        for (const w of BrowserWindow.getAllWindows()) {
            w.webContents.send("log:append", line);
        }
        return msg;
    });

    // ví dụ log
    const mainLog = log.scope("main");
    mainLog.info("Main started", fileInfo().path);

    return mainLog;
}
