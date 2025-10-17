// main/worker-manager.ts
import { IS_PRODUCTION } from "@/constant/app.constant";
import {
    codeStringCloseAnnouncements,
    codeStringKillMantineToasts,
    createCodeStringClickOrder,
    setLocalStorageScript,
} from "@/javascript-string/logic-farm";
import {
    TDataInitBot,
    TFectMainRes,
    TGateClick,
    TGateClickCancelAllOpenRes,
    TGateClickMarketPositionRes,
    TGateClickTabOpenOrderRes,
    TGateOrderMainRes,
    TPayloadFollowApi,
    TPayloadOrder,
    TResultClick,
    TResultClickCancelOpen,
    TResultClickMarketPosition,
    TResultClickOpenOrder,
    TResultClickTabOpenOrder,
} from "@/types/bot.type";
import { TWorkerData } from "@/types/worker.type";
import { BrowserWindow, Event, RenderProcessGoneDetails, WebContentsView, app, ipcMain, shell } from "electron";
import type Logger from "electron-log";
import { Worker } from "node:worker_threads";
import path from "path";

// === Bản ghi 1 worker ===
type WorkerEntry = {
    uid: number;
    worker: Worker;
    gateView?: {
        webContentsView: WebContentsView;
        attached: boolean;
    };
};

if (IS_PRODUCTION) {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
    console.trace = () => {};
}

export class BotWorkerManager {
    private entries = new Map<number, WorkerEntry>();
    private mainWindow: BrowserWindow;
    private mainLog: Logger.LogFunctions;
    private workerLog: Logger.LogFunctions;

    private payloadOrder: TPayloadOrder = {
        contract: "BTC_USDT",
        price: "100095.0",
        reduce_only: false,
        size: "1",
        tif: "poc",
    };

    // Tuỳ chỉnh: offset trái/phải & panel trên
    private readonly LEFT_OFFSET = 0; // nếu muốn chừa sidebar 48px: đặt = 48
    private readonly RIGHT_OFFSET = 0; // nếu muốn chừa khoảng bên phải
    private readonly TOP_PANEL = 500; // H_PANEL cũ của bạn

    private FLOWS_API = {
        acounts: {
            url: "https://www.gate.com/apiw/v2/futures/usdt/accounts",
            method: "GET",
        },
        orders: {
            url: "https://www.gate.com/apiw/v2/futures/usdt/orders?contract=&status=open",
            method: "GET",
        },
        positions: {
            url: "https://www.gate.com/apiw/v2/futures/usdt/positions",
            method: "GET",
        },
    };

    private GATE_TIMEOUT = "GATE_TIMEOUT";

    constructor(mainWindow: BrowserWindow, mainLog: Logger.LogFunctions, workerLog: Logger.LogFunctions) {
        this.mainWindow = mainWindow;
        this.mainLog = mainLog;
        this.workerLog = workerLog;

        // Renderer yêu cầu start nhiều worker
        ipcMain.on("worker:initMany", (_evt, arg: Omit<TDataInitBot, "parentPort">) => {
            // console.log("worker:initMany", arg.uids);
            this.startMany(arg);
        });

        // Renderer yêu cầu stop 1 worker theo uid
        ipcMain.on("worker:stopOne", (_evt, { uid }: { uid: number }) => {
            this.stopOne(uid);
        });

        ipcMain.on("worker:stopAll", (_evt) => {
            this.stopAll();
        });

        // Renderer broadcast đến tất cả worker
        ipcMain.on("worker:broadcast", (_evt, { type, payload }) => {
            this.broadcast(type, payload);
        });

        // Renderer gửi command 1 worker
        ipcMain.on("worker:send", (_evt, { uid, type, payload }) => {
            this.sendTo(uid, type, payload);
        });

        ipcMain.on("worker:toggleWebView", (_evt, { uid }) => {
            this.toggleGateView(uid);
        });
    }

    startMany(dataInitBot: Omit<TDataInitBot, "parentPort">) {
        if (dataInitBot.uids.length === 0) {
            this.sendIsChildView(false);
            return;
        }
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
        this.mainLog.info(`3) ✅ [WorkerManager]New Worker uid=${uid} | threadId= ${worker.threadId}`);

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
                    this.mainLog.info(`7) ✅ [WorkerManager] bot:init:done uid=${uid}`);

                    const gateView = this.createGateViewForUid(uid, isDebug);

                    this.interceptRequest(gateView, worker);

                    break;
                }
                case "bot:heartbeat":
                case "bot:start":
                case "bot:stop":
                case "bot:reloadWebContentsView":
                case "bot:isReady":
                case "bot:saveAccount":
                case "bot:rateCounter":
                case "bot:upsertFixLiquidation":
                case "bot:upsertFixStopLoss":
                case "bot:upsertFixStopLossQueue":
                case "bot:createFixStopLossHistories":
                case "bot:sticky:set":
                case "bot:sticky:remove":
                case "bot:ioc:sideCount":
                case "bot:sticky:clear": {
                    this.mainWindow.webContents.send(msg.type, withUid);
                    break;
                }

                case "bot:fetch": {
                    const { url, init, reqId } = msg.payload;
                    const timeoutMs = 5_000;
                    const gateView = entry.gateView;
                    if (!gateView) {
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
                                    return { ok: false, bodyText: '', error: '${this.GATE_TIMEOUT}' };
                                }
                                return { ok: false, bodyText: '', error: String(e && e.message || e) };
                                } finally { clearTimeout(to); }
                            })()
                            `;
                        const result: TFectMainRes = await gateView.webContentsView.webContents.executeJavaScript(js, true);
                        if (result.ok === false && result.error) throw new Error(result.error);
                        worker.postMessage({ type: "bot:fetch:res", payload: { ok: true, reqId, bodyText: result?.bodyText, error: null } });
                    } catch (e: any) {
                        const msg = String(e?.message || e);
                        const looksTimeout = /\btime(?:d\s+)?out\b/i.test(msg) || e?.name === "AbortError" || e?.code === "ETIMEDOUT";
                        worker.postMessage({
                            type: "bot:fetch:res",
                            payload: { ok: false, reqId, bodyText: "", error: looksTimeout ? this.GATE_TIMEOUT : msg },
                        });
                    }
                    break;
                }

                case "bot:order": {
                    const gateView = entry.gateView?.webContentsView;
                    if (!gateView) return;
                    const { payloadOrder: payloadOrderRaw, selector, reqOrderId } = msg?.payload;
                    const tag = `O${reqOrderId}`;
                    try {
                        this.payloadOrder = payloadOrderRaw;

                        // Tạo promise chờ API order
                        const waitOrder = this.waitForOneRequest(
                            gateView.webContents,
                            {
                                method: "POST",
                                urlPrefix: "https://www.gate.com/apiw/v2/futures/usdt/orders",
                            },
                            tag,
                        );

                        // Thực hiện click (trả về khi JS của bạn xong, không phải khi API xong)
                        const js = createCodeStringClickOrder(selector);
                        const resultClick: TResultClickOpenOrder = await gateView.webContents.executeJavaScript(js, true);
                        if (resultClick.ok === false && resultClick.error) {
                            throw new Error(resultClick.error);
                        }

                        // Chờ API xong, lấy body
                        const { bodyText } = await waitOrder;

                        const payload: TGateOrderMainRes = {
                            ok: true,
                            reqOrderId,
                            bodyText,
                            error: null,
                        };

                        worker.postMessage({ type: "bot:order:res", payload: payload });
                    } catch (e: any) {
                        const payload: TGateOrderMainRes = {
                            ok: false,
                            reqOrderId: reqOrderId,
                            bodyText: "",
                            error: String(e?.message || e),
                        };
                        worker.postMessage({ type: "bot:order:res", payload: payload });
                    }
                    break;
                }

                case "bot:clickTabOpenOrder": {
                    const gateView = entry.gateView?.webContentsView;

                    if (!gateView) return;

                    const { reqClickTabOpenOrderId, stringClickTabOpenOrder } = msg?.payload;

                    try {
                        const result: TResultClickTabOpenOrder = await gateView.webContents.executeJavaScript(stringClickTabOpenOrder, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClickTabOpenOrderRes = {
                            ok: true,
                            body: result.data,
                            reqClickTabOpenOrderId: reqClickTabOpenOrderId,
                            error: null,
                        };

                        worker.postMessage({ type: "bot:clickTabOpenOrder:res", payload: payload });
                    } catch (e: any) {
                        const payload: TGateClickTabOpenOrderRes = {
                            ok: false,
                            body: null,
                            reqClickTabOpenOrderId: reqClickTabOpenOrderId,
                            error: String(e?.message || e),
                        };
                        worker.postMessage({ type: "bot:clickTabOpenOrder:res", payload: payload });
                    }
                    break;
                }

                case "bot:clickCanelAllOpen": {
                    const gateView = entry.gateView?.webContentsView;

                    if (!gateView) return;

                    const { reqClickCanelAllOpenOrderId, stringClickCanelAllOpen } = msg?.payload;

                    try {
                        const result: TResultClickCancelOpen = await gateView.webContents.executeJavaScript(stringClickCanelAllOpen, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClickCancelAllOpenRes = {
                            ok: result.ok,
                            body: result.data,
                            reqClickCanelAllOpenOrderId: reqClickCanelAllOpenOrderId,
                            error: null,
                        };

                        worker.postMessage({ type: "bot:clickCanelAllOpen:res", payload: payload });
                    } catch (e: any) {
                        const payload: TGateClickCancelAllOpenRes = {
                            ok: false,
                            body: null,
                            reqClickCanelAllOpenOrderId: reqClickCanelAllOpenOrderId,
                            error: String(e?.message || e),
                        };
                        worker.postMessage({ type: "bot:clickCanelAllOpen:res", payload: payload });
                    }
                    break;
                }

                case "bot:reloadWebContentsView:Request": {
                    const gateView = entry.gateView?.webContentsView;

                    if (!gateView) {
                        this.mainLog.error("bot:reloadWebContentsView:Request: gateView not found");
                        return;
                    }

                    try {
                        await this.reloadAndWait(gateView, worker, 30000);
                        // re-inject mọi thứ cần chạy lại sau reload
                        gateView.webContents.executeJavaScript(setLocalStorageScript, true).catch(() => {});
                        gateView.webContents.executeJavaScript(codeStringKillMantineToasts, true).catch(() => {});
                        // (nếu có) re-enable các patch WS / CDP, v.v.

                        worker.postMessage({ type: "bot:reloadWebContentsView:Response", payload: msg?.payload });
                    } catch (e) {
                        // log lỗi reload nếu cần
                        this.mainLog.error(`bot:reloadWebContentsView:Request: ${e}`);
                    }
                    break;
                }

                case "bot:clickMarketPosition": {
                    const gateView = entry.gateView?.webContentsView;

                    if (!gateView) return;

                    const { reqClickMarketPositionId, stringClickMarketPosition } = msg?.payload;

                    try {
                        const result: TResultClickMarketPosition = await gateView.webContents.executeJavaScript(stringClickMarketPosition, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClickMarketPositionRes = {
                            ok: result.ok,
                            body: result.data,
                            reqClickMarketPositionId: reqClickMarketPositionId,
                            error: null,
                        };

                        worker.postMessage({ type: "bot:clickMarketPosition:res", payload: payload });
                    } catch (e: any) {
                        const payload: TGateClickMarketPositionRes = {
                            ok: false,
                            body: null,
                            reqClickMarketPositionId: reqClickMarketPositionId,
                            error: String(e?.message || e),
                        };
                        worker.postMessage({ type: "bot:clickMarketPosition:res", payload: payload });
                    }
                    break;
                }

                case "bot:checkLogin": {
                    const gateView = entry.gateView?.webContentsView;

                    if (!gateView) return;

                    const { reqCheckLoginId, stringCheckLogin } = msg?.payload;

                    try {
                        const result: TResultClick<boolean> = await gateView.webContents.executeJavaScript(stringCheckLogin, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClick<boolean> & { reqCheckLoginId: number } = {
                            ok: result.ok,
                            body: result.data,
                            reqCheckLoginId: reqCheckLoginId,
                            error: null,
                        };

                        worker.postMessage({ type: "bot:checkLogin:res", payload: payload });
                    } catch (e: any) {
                        const payload: TGateClick<boolean> & { reqCheckLoginId: number } = {
                            ok: false,
                            body: null,
                            reqCheckLoginId: reqCheckLoginId,
                            error: String(e?.message || e),
                        };
                        worker.postMessage({ type: "bot:checkLogin:res", payload: payload });
                    }
                    break;
                }

                case "bot:clickClearAll": {
                    const gateView = entry.gateView?.webContentsView;

                    if (!gateView) return;

                    const { reqClickClearAllId, stringClickClearAll } = msg?.payload;

                    try {
                        const result: TResultClick<boolean> = await gateView.webContents.executeJavaScript(stringClickClearAll, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClick<boolean> & { reqClickClearAllId: number } = {
                            ok: result.ok,
                            body: result.data,
                            reqClickClearAllId: reqClickClearAllId,
                            error: null,
                        };

                        worker.postMessage({ type: "bot:clickClearAll:res", payload: payload });
                    } catch (e: any) {
                        const payload: TGateClick<boolean> & { reqClickClearAllId: number } = {
                            ok: false,
                            body: null,
                            reqClickClearAllId: reqClickClearAllId,
                            error: String(e?.message || e),
                        };
                        worker.postMessage({ type: "bot:clickClearAll:res", payload: payload });
                    }
                    break;
                }

                case "bot:getUid": {
                    const gateView = entry.gateView?.webContentsView;

                    if (!gateView) return;

                    const { reqGetUidId, stringGetUid } = msg?.payload;

                    try {
                        const result: TResultClick<string | null> = await gateView.webContents.executeJavaScript(stringGetUid, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClick<string | null> & { reqGetUidId: number } = {
                            ok: result.ok,
                            body: result.data,
                            reqGetUidId: reqGetUidId,
                            error: null,
                        };

                        worker.postMessage({ type: "bot:getUid:res", payload: payload });
                    } catch (e: any) {
                        const payload: TGateClick<string> & { reqGetUidId: number } = {
                            ok: false,
                            body: null,
                            reqGetUidId: reqGetUidId,
                            error: String(e?.message || e),
                        };
                        worker.postMessage({ type: "bot:getUid:res", payload: payload });
                    }

                    break;
                }
            }
        });

        worker.on("error", (err) => {
            this.workerLog.error(`[WorkerManager] worker error uid=${uid}`, err);
        });

        worker.on("exit", (code) => {
            this.workerLog.error(`[WorkerManager] worker exit uid=${uid} code=${code}`);
            // dọn map + view
            // this.destroyOne(uid);
            // báo renderer
            this.mainWindow?.webContents.send("worker:exit", { uid, code });
        });

        worker.once("online", () => {
            this.mainLog.info(`4) ✅ [WorkerManager] Worker Online uid=${uid}`);
            const payloadInit: Omit<TDataInitBot, "parentPort"> = {
                ...initBase,
                uidDB: uid,
            };
            worker.postMessage({ type: "bot:init", payload: payloadInit });
            this.mainLog.info(`5) ✅ [WorkerManager] bot:init sent | uid=${uid} | threadId=${worker?.threadId}`);
        });

        // lắng nghe từ rerender
        ipcMain.on("bot:start", (event, data) => {
            worker.postMessage({ type: "bot:start", payload: data });
        });
        ipcMain.on("bot:stop", (event, data) => {
            worker.postMessage({ type: "bot:stop", payload: data });
        });
        ipcMain.on("bot:reloadWebContentsView", (event, data) => {
            worker.postMessage({ type: "bot:reloadWebContentsView", payload: data });
        });
        ipcMain.on("bot:setWhiteList", (event, data) => {
            worker.postMessage({ type: "bot:setWhiteList", payload: data });
        });
        ipcMain.on("bot:settingUser", (event, data) => {
            worker.postMessage({ type: "bot:settingUser", payload: data });
        });
        ipcMain.on("bot:uiSelector", (event, data) => {
            worker.postMessage({ type: "bot:uiSelector", payload: data });
        });
        ipcMain.on("bot:blackList", (event, data) => {
            worker.postMessage({ type: "bot:blackList", payload: data });
        });
        ipcMain.on("bot:rateMax:set", (event, data) => {
            worker.postMessage({ type: "bot:rateMax:set", payload: data });
        });
        ipcMain.on("bot:takeProfitAccount", (event, data) => {
            worker.postMessage({ type: "bot:takeProfitAccount", payload: data });
        });
        ipcMain.on("bot:removeFixStopLossQueue", (event, data) => {
            worker.postMessage({ type: "bot:removeFixStopLossQueue", payload: data });
        });
        ipcMain.on("bot:ioc:long", (event, data) => {
            worker.postMessage({ type: "bot:ioc:long", payload: data });
        });
        ipcMain.on("bot:ioc:short", (event, data) => {
            worker.postMessage({ type: "bot:ioc:short", payload: data });
        });
        ipcMain.on("bot:ioc:hedge", (event, data) => {
            worker.postMessage({ type: "bot:ioc:hedge", payload: data });
        });
        ipcMain.on("bot:ioc:oneway", (event, data) => {
            worker.postMessage({ type: "bot:ioc:oneway", payload: data });
        });
        ipcMain.on("bot:whiteListMartingale", (event, data) => {
            worker.postMessage({ type: "bot:whiteListMartingale", payload: data });
        });
        ipcMain.on("bot:whiteListFarmIoc", (event, data) => {
            worker.postMessage({ type: "bot:whiteListFarmIoc", payload: data });
        });
        ipcMain.on("bot:whiteListScalpIoc", (event, data) => {
            worker.postMessage({ type: "bot:whiteListScalpIoc", payload: data });
        });
    }

    stopOne(uid: number) {
        const entry = this.entries.get(uid);
        if (!entry) return;
        entry.worker.postMessage({ type: "bot:stop", payload: { reason: "manual-stop" } });
        // optional: terminate sau 1 khoảng
        setTimeout(() => this.destroyOne(uid), 500);
    }

    async destroyOne(uid: number) {
        const entry = this.entries.get(uid);
        if (!entry) return;

        // 1) Dừng worker trước
        try {
            entry.worker.removeAllListeners?.();
            const code = await entry.worker.terminate();
            this.mainLog.info(`[WorkerManager] worker terminated uid=${uid} exitCode=${code}`);
        } catch (e) {
            this.mainLog.error(`[WorkerManager] worker terminate error uid=${uid}: ${e}`);
        }

        // 2) Huỷ Gate WebContentsView đúng thứ tự
        const view = entry.gateView?.webContentsView;
        if (view) {
            const wc = view.webContents;

            // (a) Tháo khỏi cây view để giải phóng liên kết layout/render
            try {
                this.mainWindow.contentView.removeChildView(view);
                this.sendIsChildView(false);
            } catch {}

            // (b) Dọn dẹp phụ trợ trước khi close
            try {
                if (wc.isDevToolsOpened()) wc.closeDevTools();
            } catch {}
            try {
                wc.stop();
            } catch {}
            try {
                wc.removeAllListeners();
            } catch {}

            // (c) Đóng và CHỜ 'destroyed'
            await new Promise<void>((resolve) => {
                if (wc.isDestroyed()) return resolve();

                const timer = setTimeout(() => {
                    this.mainLog.warn(`[WorkerManager] webContents close timed out uid=${uid}`);
                    resolve(); // fallback
                }, 3000);

                wc.once("destroyed", () => {
                    clearTimeout(timer);
                    resolve();
                });

                // Bỏ qua beforeunload để không bị chặn
                try {
                    wc.close({ waitForBeforeUnload: false });
                } catch {
                    clearTimeout(timer);
                    resolve();
                }
            });

            this.mainLog.info(`gateView uid=${uid} destroyed=${wc.isDestroyed()}`);
        }

        // 3) Xoá entry để GC gọn gàng
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
        const partition = `persist:gate${uid}`;
        const gateView = new WebContentsView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,

                // dùng session riêng để bạn intercept cookie / webRequest, v.v.
                partition: partition,

                // nếu bạn có preload riêng cho Gate (không bắt buộc)
                // preload: path.join(app.isPackaged ? __dirname : path.join(__dirname, "../../assets"), "gate-preload.js"),
            },
        });

        this.mainWindow.contentView.addChildView(gateView);
        this.sendIsChildView(true);

        const entry = this.entries.get(uid);
        if (entry) {
            entry.gateView = {
                webContentsView: gateView,
                attached: true,
            };
        }

        const layoutGateView = () => {
            if (this.mainWindow.isDestroyed()) return;
            const { width, height } = this.mainWindow.getContentBounds();
            gateView.setBounds({
                x: 0,
                y: this.TOP_PANEL,
                width: Math.max(0, width),
                height: Math.max(0, height - this.TOP_PANEL),
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
            gateView.webContents.executeJavaScript(codeStringCloseAnnouncements, true);
        });

        if (!IS_PRODUCTION) {
            if (isDebug) {
                gateView.webContents.openDevTools({ mode: "detach" });
            }
        }

        return gateView;
    }

    private attachView(uid: number) {
        const rec = this.entries.get(uid);
        if (!rec || !rec.gateView || rec.gateView.attached) return;

        this.mainWindow.contentView.addChildView(rec.gateView.webContentsView);
        this.sendIsChildView(true);

        rec.gateView.attached = true;
    }

    private detachView(uid: number) {
        const rec = this.entries.get(uid);
        if (!rec || !rec.gateView || !rec.gateView.attached) return;

        try {
            this.mainWindow.contentView.removeChildView(rec.gateView.webContentsView);
            this.sendIsChildView(false);
        } catch {}

        rec.gateView.attached = false;
    }

    private toggleGateView(uid: number): boolean {
        let rec = this.entries.get(uid);

        console.log("toggleGateView", uid, rec?.gateView?.attached);

        if (rec?.gateView?.attached) {
            this.detachView(uid);
            return false; // đang tắt
        } else {
            this.attachView(uid);
            return true; // đang bật
        }
    }

    private sendIsChildView(isChildView: boolean) {
        this.mainWindow.webContents.send("bot:isChildView", { isChildView });
    }

    private waitForOneRequest(
        wc: Electron.WebContents,
        match: { method: string; urlPrefix: string },
        tag: string,
        timeoutMs = 8000,
    ): Promise<{ bodyText: string; status?: number }> {
        const dbg = wc.debugger;
        const t0 = Date.now();

        return new Promise((resolve, reject) => {
            let done = false;
            let timer: NodeJS.Timeout | null = null;
            const tracked = new Set<string>();

            const clean = () => {
                if (timer) clearTimeout(timer);
                dbg.off("message", onMsg);
                tracked.clear();
            };

            const finish = (ok: boolean, msg: string, extra?: any) => {
                if (done) return;
                done = true;
            };

            const onMsg = async (_e: any, method: string, params: any) => {
                try {
                    if (method === "Network.requestWillBeSent") {
                        const req = params.request;
                        if (!req) return;
                        if (req.method === match.method && String(req.url).startsWith(match.urlPrefix)) {
                            tracked.add(params.requestId);
                        }
                    } else if (method === "Network.responseReceived") {
                        const id = params.requestId;
                        if (tracked.has(id)) {
                        }
                    } else if (method === "Network.loadingFinished") {
                        const id = params.requestId;
                        if (!tracked.has(id)) return;

                        try {
                            const { body, base64Encoded } = await dbg.sendCommand("Network.getResponseBody", { requestId: id });
                            const text = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : (body as string);
                            finish(true, "body received", { len: text.length });
                            clean();
                            resolve({ bodyText: text, status: undefined });
                        } catch (e: any) {
                            finish(false, "getBody fail", { err: String(e?.message || e) });
                            clean();
                            reject(e);
                        }
                    } else if (method === "Network.loadingFailed") {
                        const id = params.requestId;
                        if (!tracked.has(id)) return;
                        finish(false, "loadingFailed", { errorText: params.errorText });
                        clean();
                        reject(new Error(params.errorText || "loadingFailed"));
                    }
                } catch (e) {
                    finish(false, "onMsg exception", { err: String(e) });
                    clean();
                    reject(e);
                }
            };

            dbg.on("message", onMsg);
            timer = setTimeout(() => {
                finish(false, `waitForOneRequest ${this.GATE_TIMEOUT}`);
                clean();
                reject(new Error(`waitForOneRequest ${this.GATE_TIMEOUT}`));
            }, timeoutMs);
        });
    }

    private async reloadAndWait(gateView: Electron.WebContentsView, botWorker: import("worker_threads").Worker, timeoutMs = 30000) {
        const wc = gateView.webContents;

        return new Promise<void>((resolve, reject) => {
            let timer: NodeJS.Timeout;

            const cleanup = () => {
                clearTimeout(timer);
                wc.off("did-finish-load", onDone);
                wc.off("did-fail-load", onFail);
                wc.off("render-process-gone", onGone);
            };

            const onDone = () => {
                cleanup();
                resolve();
            };

            const onFail: (
                event: Event,
                errorCode: number,
                errorDescription: string,
                validatedURL: string,
                isMainFrame: boolean,
                frameProcessId: number,
                frameRoutingId: number,
            ) => void = (_e, code, desc, url, isMainFrame) => {
                if (!isMainFrame) return;
                cleanup();
                reject(new Error(`did-fail-load ${code} ${desc}`));
            };

            const onGone: (event: Event, details: RenderProcessGoneDetails) => void = (_e, details) => {
                cleanup();
                reject(new Error(`renderer gone: ${details?.reason || "unknown"}`));
            };

            timer = setTimeout(() => {
                cleanup();
                botWorker.postMessage({ type: "bot:webview:reload_timeout" });
                reject(new Error("reload timeout"));
            }, timeoutMs);

            // đăng ký CHỈ cho lần reload này
            wc.once("did-finish-load", onDone);
            wc.once("did-fail-load", onFail);
            wc.once("render-process-gone", onGone);

            wc.reload(); // hoặc reloadIgnoringCache()
        });
    }

    private interceptRequest(gateView: WebContentsView, botWorker: import("worker_threads").Worker) {
        const wc = gateView.webContents;

        // Attach debugger 1 lần
        if (!wc.debugger.isAttached()) {
            wc.debugger.attach("1.3"); // version protocol
            wc.debugger.sendCommand("Network.enable");
            wc.debugger.sendCommand("Fetch.enable", {
                patterns: [
                    { urlPattern: "*://www.gate.com/*", requestStage: "Request" }, // chỉ domain gate
                ],
            });
        }

        // Track requestId -> {method,url,status} cho các request bạn quan tâm
        const tracked = new Map<string, { method: string; url: string; status?: number }>();
        const watchNetworkIds = new Set<string>();

        wc.debugger.on("message", async (_e, method, params: any) => {
            try {
                switch (method) {
                    /* --------- A) CHẶN & SỬA REQUEST TRƯỚC KHI GỬI --------- */
                    case "Fetch.requestPaused": {
                        const { requestId, request, networkId } = params as {
                            requestId: string;
                            networkId?: string;
                            request: { url: string; method: string; headers?: Record<string, string>; postData?: string };
                        };
                        const key = `${request.method} ${request.url}`;
                        // console.log(`[Fetch.requestPaused] ${key}`);

                        switch (key) {
                            case "POST https://www.gate.com/apiw/v2/futures/usdt/orders":
                                // console.log(`[Fetch.requestPaused] ${key}`);

                                let bodyOrder = request.postData ?? "";
                                try {
                                    const obj = JSON.parse(bodyOrder);

                                    const modified = this.handlePayloadModification(obj, {
                                        contract: this.payloadOrder.contract,
                                        price: this.payloadOrder.price,
                                        reduce_only: this.payloadOrder.reduce_only,
                                        size: this.payloadOrder.size,
                                        tif: this.payloadOrder.tif,
                                    });

                                    const jsonText = JSON.stringify(modified);

                                    const postDataB64 = Buffer.from(jsonText, "utf8").toString("base64");

                                    await wc.debugger.sendCommand("Fetch.continueRequest", {
                                        requestId,
                                        postData: postDataB64,
                                    });

                                    if (networkId) watchNetworkIds.add(networkId);
                                } catch (err) {
                                    console.log(`có lỗi`, err);
                                    // await wc.debugger.sendCommand("Fetch.continueRequest", { requestId });
                                }
                                break;

                            default: {
                                // Các request khác: cho đi thẳng
                                await wc.debugger.sendCommand("Fetch.continueRequest", { requestId });
                                break;
                            }
                        }
                        break;
                    }

                    /* --------- B) THEO DÕI & LẤY BODY RESPONSE --------- */
                    case "Network.requestWillBeSent": {
                        const reqId = params.requestId as string;
                        const url = params.request?.url as string;
                        const method = params.request?.method as string;
                        const key = `${method} ${url}`;

                        // === GIỮ SWITCH CỦA BẠN Ở ĐÂY ===
                        switch (key) {
                            case `${this.FLOWS_API.acounts.method} ${this.FLOWS_API.acounts.url}`:
                                tracked.set(reqId, { method, url });
                                break;
                            case `${this.FLOWS_API.orders.method} ${this.FLOWS_API.orders.url}`:
                                tracked.set(reqId, { method, url });
                                break;
                            case `${this.FLOWS_API.positions.method} ${this.FLOWS_API.positions.url}`:
                                tracked.set(reqId, { method, url });
                                break;
                            default:
                                break;
                        }

                        break;
                    }

                    case "Network.responseReceived": {
                        const reqId = params.requestId as string;
                        if (tracked.has(reqId)) {
                            const status = params.response?.status as number | undefined;
                            const rec = tracked.get(reqId)!;
                            rec.status = status;
                        }
                        break;
                    }

                    case "Network.loadingFinished": {
                        const reqId = params.requestId as string;
                        const rec = tracked.get(reqId);
                        if (!rec) break;
                        // Lấy body (đã giải nén). Có thể lớn → DevTools trả base64 khi cần.
                        const { body, base64Encoded } = await wc.debugger.sendCommand("Network.getResponseBody", { requestId: reqId });
                        const bodyText = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : (body as string);
                        const key = `${rec.method} ${rec.url}`;

                        const valueFollowApi: TWorkerData<TPayloadFollowApi> = {
                            type: "bot:followApi",
                            payload: { method: rec.method, url: rec.url, status: rec.status, bodyText },
                        };

                        switch (key) {
                            case `${this.FLOWS_API.acounts.method} ${this.FLOWS_API.acounts.url}`:
                                botWorker?.postMessage(valueFollowApi);
                                break;
                            case `${this.FLOWS_API.orders.method} ${this.FLOWS_API.orders.url}`:
                                botWorker?.postMessage(valueFollowApi);
                                break;
                            case `${this.FLOWS_API.positions.method} ${this.FLOWS_API.positions.url}`:
                                botWorker?.postMessage(valueFollowApi);
                                break;
                            default:
                                break;
                        }

                        // Dọn state để không rò rỉ
                        tracked.delete(reqId);
                        break;
                    }

                    case "Network.loadingFailed":
                    case "Network.loadingFinishedExtraInfo":
                    case "Network.responseReceivedExtraInfo": {
                        // Không bắt buộc dùng, nhưng có thể dọn map nếu fail
                        const reqId = params.requestId as string;
                        if (tracked.has(reqId) && method === "Network.loadingFailed") tracked.delete(reqId);
                        break;
                    }
                }
            } catch (e) {
                // Nếu body chưa sẵn (hiếm), bạn có thể thử lại tại loadingFinished; ở đây log là đủ
                console.error("[intercept-devtools error]", e);
            }
        });

        // Khi window đóng, nên detach
        wc.once("destroyed", () => {
            try {
                wc.debugger.detach();
            } catch {}
            tracked.clear();
        });
    }

    handlePayloadModification(data: any, dataModify: any) {
        if (data?.order_type === "market") {
            // console.info({ "Lệnh thanh lý market bỏ qua": data });
            return data;
        }

        // console.info({ "🛠️ Payload trước khi sửa": data });
        const updated = {
            ...data,
            ...dataModify,
        };
        // console.info({ "🛠️ Payload sau khi sửa": updated });
        return updated;
    }
}
