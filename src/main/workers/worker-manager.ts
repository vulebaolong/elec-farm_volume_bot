// main/worker-manager.ts
import { BrowserWindow, WebContentsView, ipcMain, app, shell } from "electron";
import path from "path";
import type Logger from "electron-log";
import { Worker } from "node:worker_threads";
import { TDataInitBot, TFectMainRes } from "@/types/bot.type";
import { GATE_TIMEOUT, interceptRequest } from "./init.worker";
import { codeStringKillMantineToasts, setLocalStorageScript } from "@/javascript-string/logic-farm";

// === Bản ghi 1 worker ===
type WorkerEntry = {
    uid: number;
    worker: Worker;
    gateView?: WebContentsView;
};

export class BotWorkerManager {
    private entries = new Map<number, WorkerEntry>();
    private mainWindow: BrowserWindow;
    private mainLog: Logger.LogFunctions;
    private workerLog: Logger.LogFunctions;

    constructor(mainWindow: BrowserWindow, mainLog: Logger.LogFunctions, workerLog: Logger.LogFunctions) {
        this.mainWindow = mainWindow;
        this.mainLog = mainLog;
        this.workerLog = workerLog;

        // Renderer yêu cầu start nhiều worker
        ipcMain.on("worker:initMany", (_evt, arg: Omit<TDataInitBot, "parentPort">) => {
            console.log("worker:initMany", arg.uids);
            this.startMany(arg);
        });

        // Renderer yêu cầu stop 1 worker theo uid
        ipcMain.on("worker:stopOne", (_evt, { uid }: { uid: number }) => {
            this.stopOne(uid);
        });

        // Renderer broadcast đến tất cả worker
        ipcMain.on("worker:broadcast", (_evt, { type, payload }) => {
            this.broadcast(type, payload);
        });

        // Renderer gửi command 1 worker
        ipcMain.on("worker:send", (_evt, { uid, type, payload }) => {
            this.sendTo(uid, type, payload);
        });
    }

    startMany(dataInitBot: Omit<TDataInitBot, "parentPort">) {
        for (const uid of dataInitBot.uids) {
            this.startOne(uid.uid, dataInitBot, true);
        }
    }

    startOne(uid: number, initBase: Omit<TDataInitBot, "parentPort">, isDebug: boolean) {
        // Đã có thì bỏ qua
        if (this.entries.has(uid)) {
            this.mainLog.info(`[WorkerManager] Worker for uid=${uid} already running`);
            return;
        }

        const workerPath = app.isPackaged
            ? path.join(process.resourcesPath, "app.asar.unpacked", "dist", "main", "workers", "bot.worker.js")
            : path.join(__dirname, "workers", "bot.worker.bundle.dev.js");

        const worker = new Worker(workerPath);
        this.mainLog.info(`[WorkerManager] New Worker uid=${uid} | threadId=`, worker.threadId);

        const entry: WorkerEntry = { uid, worker };
        this.entries.set(uid, entry);

        // === Lắng nghe từ worker ===
        worker.on("message", async (msg: any) => {
            // TIP: nếu worker chưa tự include uid trong msg, ta sẽ "gắn uid" trước khi forward xuống renderer
            const withUid = { ...msg, uid };

            // Map một số message sang renderer, luôn kèm uid:
            switch (msg?.type) {
                case "bot:log": {
                    const { level = "info", text = "" } = msg.payload || {};
                    if (level === "error") this.workerLog.error(`[uid=${uid}] ${text}`);
                    else if (level === "warn") this.workerLog.warn(`[uid=${uid}] ${text}`);
                    else if (level === "debug") this.workerLog.debug?.(`[uid=${uid}] ${text}`);
                    else this.workerLog.info(`[uid=${uid}] ${text}`);
                    break;
                }
                case "bot:init:done": {
                    this.mainLog.info(`[WorkerManager] bot:init:done uid=${uid}`);
                    // GateView riêng theo uid (session/partition tách biệt)
                    const gateView = this.createGateViewForUid(uid, isDebug);
                    entry.gateView = gateView;

                    // intercept request gắn theo gateView + worker tương ứng
                    interceptRequest(gateView, worker);

                    // thông báo renderer biết worker này đã sẵn sàng
                    this.mainWindow?.webContents.send("bot:isReady", withUid);
                    break;
                }
                case "bot:heartbeat":
                case "bot:start":
                case "bot:stop":
                case "bot:reloadWebContentsView":
                case "bot:saveAccount":
                case "bot:rateCounter":
                case "bot:upsertFixLiquidation":
                case "bot:upsertFixStopLoss":
                case "bot:upsertFixStopLossQueue":
                case "bot:createFixStopLossHistories":
                case "bot:sticky:set":
                case "bot:sticky:remove":
                case "bot:sticky:clear": {
                    this.mainWindow?.webContents.send(msg.type, withUid);
                    break;
                }

                // Các request cần gateView thực thi:
                case "bot:fetch": {
                    const { url, init, reqId } = msg.payload;
                    const timeoutMs = 5_000;
                    const gv = entry.gateView;
                    if (!gv) {
                        worker.postMessage({ type: "bot:fetch:res", payload: { ok: false, reqId, bodyText: "", error: "gateView not found" } });
                        return;
                    }
                    try {
                        const js = `
                            (async () => {
                                const ctrl = new AbortController();
                                const to = setTimeout(() => ctrl.abort(new DOMException('timeout','AbortError')), ${timeoutMs});
                                try {
                                const res = await fetch(${JSON.stringify(url)}, {
                                    ...${JSON.stringify(init || {})},
                                    credentials: 'include',
                                    signal: ctrl.signal
                                });
                                const text = await res.text();
                                return { ok: true, bodyText: text, error: null };
                                } catch (e) {
                                if (e && e.name === 'AbortError') {
                                    return { ok: false, bodyText: '', error: '${GATE_TIMEOUT}' };
                                }
                                return { ok: false, bodyText: '', error: String(e && e.message || e) };
                                } finally { clearTimeout(to); }
                            })()
                            `;
                        const result: TFectMainRes = await gv.webContents.executeJavaScript(js, true);
                        if (result.ok === false && result.error) throw new Error(result.error);
                        worker.postMessage({ type: "bot:fetch:res", payload: { ok: true, reqId, bodyText: result?.bodyText, error: null } });
                    } catch (e: any) {
                        const msg = String(e?.message || e);
                        const looksTimeout = /\btime(?:d\s+)?out\b/i.test(msg) || e?.name === "AbortError" || e?.code === "ETIMEDOUT";
                        worker.postMessage({
                            type: "bot:fetch:res",
                            payload: { ok: false, reqId, bodyText: "", error: looksTimeout ? GATE_TIMEOUT : msg },
                        });
                    }
                    break;
                }

                // … Các case "bot:order", "bot:clickTabOpenOrder", "bot:clickCanelAllOpen", "bot:clickMarketPosition", "bot:clickClearAll"
                // bạn giữ nguyên logic cũ, chỉ thay gateView = entry.gateView
                // và nhớ postMessage lại cho "worker" tương ứng (entry.worker)
            }
        });

        worker.on("error", (err) => {
            this.workerLog.error(`[WorkerManager] worker error uid=${uid}`, err);
        });

        worker.on("exit", (code) => {
            this.workerLog.error(`[WorkerManager] worker exit uid=${uid} code=${code}`);
            // dọn map + view
            this.destroyOne(uid);
            // báo renderer
            this.mainWindow?.webContents.send("worker:exit", { uid, code });
        });

        worker.once("online", () => {
            this.workerLog.info(`[WorkerManager] Worker Online uid=${uid}`);
            worker.postMessage({ type: "bot:init", payload: { ...initBase, uid } });
            this.mainLog.info(`[WorkerManager] bot:init sent | uid=${uid} | threadId=${worker?.threadId}`);
        });
    }

    stopOne(uid: number) {
        const entry = this.entries.get(uid);
        if (!entry) return;
        entry.worker.postMessage({ type: "bot:stop", payload: { reason: "manual-stop" } });
        // optional: terminate sau 1 khoảng
        setTimeout(() => this.destroyOne(uid), 500);
    }

    destroyOne(uid: number) {
        const entry = this.entries.get(uid);
        if (!entry) return;
        try {
            entry.worker.terminate().catch(() => {});
        } catch {}
        if (entry.gateView) {
            try {
                this.mainWindow?.contentView.removeChildView(entry.gateView);
            } catch {}
        }
        this.entries.delete(uid);
    }

    stopAll() {
        for (const uid of this.entries.keys()) this.stopOne(uid);
    }

    broadcast(type: string, payload?: any) {
        for (const e of this.entries.values()) {
            e.worker.postMessage({ type, payload });
        }
    }

    sendTo(uid: number, type: string, payload?: any) {
        const e = this.entries.get(uid);
        if (!e) return;
        e.worker.postMessage({ type, payload });
    }

    private createGateViewForUid(uid: number, isDebug: boolean): WebContentsView {
        // Tạo WebContentsView riêng theo uid với session/partition tách biệt
        const partition = `persist:gate:${uid}`;
        // --- Gate WebContentsView ---
        const gateView = new WebContentsView({
            webPreferences: {
                // bảo mật: không cần Node integration trong trang web Gate
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,

                // dùng session riêng để bạn intercept cookie / webRequest, v.v.
                partition: partition,

                // nếu bạn có preload riêng cho Gate (không bắt buộc)
                // preload: path.join(app.isPackaged ? __dirname : path.join(__dirname, "../../assets"), "gate-preload.js"),
            },
        });
        // add vào contentView root của window
        this.mainWindow.contentView.addChildView(gateView);

        const SIDEBAR_W = 200; // chiều rộng sidebar bên trái (px)
        // layout: để Gate chiếm bên phải, phần trái để app React hiển thị
        const L_PANEL = 600; // px: độ rộng panel trái cho UI của bạn
        const x = 1024;
        const H_PANEL = 500;

        const layoutGateView = () => {
            if (this.mainWindow.isDestroyed()) return;
            const { width, height } = this.mainWindow.getContentBounds();
            gateView.setBounds({
                x: 0, // chừa 48px bên trái
                y: H_PANEL,
                width: Math.max(0, width),
                height: Math.max(0, height - H_PANEL),
            });
        };
        layoutGateView();
        this.mainWindow.on("resize", layoutGateView);

        gateView.webContents.setWindowOpenHandler(({ url }) => {
            // mở popup ngoài app
            shell.openExternal(url);
            return { action: "deny" };
        });

        // load trang Gate
        gateView.webContents.loadURL("https://www.gate.com/futures/USDT/BTC_USDT").then(() => {
            gateView.webContents.executeJavaScript(setLocalStorageScript, true);
            gateView.webContents.executeJavaScript(codeStringKillMantineToasts, true);
        });

        if (isDebug) {
            gateView.webContents.openDevTools({ mode: "detach" });
        }

        return gateView;
    }
}
