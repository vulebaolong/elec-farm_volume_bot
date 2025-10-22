import { BrowserWindow, ipcMain, shell } from "electron";
import log from "electron-log/main";
import fsp from "node:fs/promises";
import path from "node:path";
import fs from "node:fs";
import { IS_PRODUCTION } from "@/constant/app.constant";

export function initLog() {
    log.initialize();
    setupLogTailFromFile();
    // (tuỳ chọn) cấu hình mức log
    // main → renderer qua IPC để bạn thấy log main trong DevTools của renderer.
    // error < warn < info < verbose < debug < silly
    log.transports.file.level = "silly";
    log.errorHandler.startCatching();
    log.eventLogger.startLogging();

    if (IS_PRODUCTION) {
        log.transports.console.level = false;
        log.transports.ipc.level = false;
    } else {
        // log.transports.ipc.level = "silly";
    }
    log.transports.console.level = false;
    log.transports.ipc.level = false;

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

    return log;
}

type TailState = {
    path: string;
    offset: number;
    partial: string; // giữ dòng dở khi chunk không kết thúc bằng \n
    watcher?: fs.FSWatcher;
};

function broadcast(line: string) {
    for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send("log:append", line);
    }
}

async function tryStat(p: string) {
    try {
        return await fsp.stat(p);
    } catch {
        return null;
    }
}

async function readNewBytes(state: TailState) {
    const st = await tryStat(state.path);
    if (!st) return;

    // file bị truncate (clear)
    if (st.size < state.offset) {
        state.offset = 0;
        state.partial = "";
    }
    // có bytes mới
    if (st.size > state.offset) {
        await new Promise<void>((resolve, reject) => {
            const stream = fs.createReadStream(state.path, {
                start: state.offset,
                end: st.size - 1,
                encoding: "utf8",
            });

            let data = "";
            stream.on("data", (chunk) => {
                data += chunk as string;
            });
            stream.on("end", () => {
                state.offset = st.size;
                const text = state.partial + data;
                const lines = text.split(/\r?\n/);
                state.partial = lines.pop() ?? ""; // giữ lại mẩu dở
                for (const line of lines) {
                    if (line.length) broadcast(line);
                }
                resolve();
            });
            stream.on("error", reject);
        });
    }
}

export async function setupLogTailFromFile() {
    // chỉ khởi tạo 1 lần (tránh HMR dev tạo nhiều watcher)
    const g = global as any;
    if (g.__FILE_TAILER_STARTED__) return;
    g.__FILE_TAILER_STARTED__ = true;

    const fileInfo = log.transports.file.getFile();
    const state: TailState = {
        path: fileInfo.path,
        offset: 0,
        partial: "",
        watcher: undefined,
    };

    // đặt offset = kích thước hiện tại -> KHÔNG bắn lại log cũ
    const st = await tryStat(state.path);
    state.offset = st?.size ?? 0;

    // watcher: đọc phần mới mỗi khi file đổi
    const attachWatcher = () => {
        try {
            state.watcher?.close();
        } catch {}
        state.watcher = fs.watch(state.path, { persistent: true }, (event) => {
            if (event === "change") {
                // đọc phần mới
                readNewBytes(state).catch(() => {});
            } else if (event === "rename") {
                // file có thể bị thay thế (rotate/truncate hard). Gắn lại sau một nhịp.
                setTimeout(async () => {
                    try {
                        state.watcher?.close();
                    } catch {}
                    // làm mới path (phòng khi electron-log đổi file)
                    state.path = log.transports.file.getFile().path;
                    const st2 = await tryStat(state.path);
                    state.offset = st2?.size ?? 0;
                    state.partial = "";
                    attachWatcher();
                }, 100);
            }
        });
    };

    attachWatcher();
}
