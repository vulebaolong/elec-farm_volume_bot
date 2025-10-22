// main/worker-manager.ts
import { IS_PRODUCTION } from "@/constant/app.constant";
import {
    codeStringCloseAnnouncements,
    codeStringKillMantineToasts,
    createCodeStringClickOrder,
    setLocalStorageScript,
} from "@/javascript-string/logic-farm";
import { TGateApiRes } from "@/types/base-gate.type";
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
import { TOrderOpen } from "@/types/order.type";
import { TWorkerData } from "@/types/worker.type";
import { BrowserWindow, Event, RenderProcessGoneDetails, WebContentsView, app, ipcMain, shell } from "electron";
import type Logger from "electron-log";
import { Worker } from "node:worker_threads";
import path from "path";

// === Bản ghi 1 worker ===
type WorkerEntry = {
    uid: number;
    worker: Worker;
    attached: boolean;
    webContentsViewGate?: WebContentsView;
    layoutGateView?: () => void;
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
        createOrders: {
            method: "POST",
            url: "https://www.gate.com/apiw/v2/futures/usdt/orders",
        },
    };
    private REQUEST_API = {
        positions: {
            url: "https://www.gate.com/apiw/v2/futures/usdt/positions",
            method: "GET",
        },
        orders: {
            url: "https://www.gate.com/apiw/v2/futures/usdt/orders",
            method: "POST",
        },
    };

    private GATE_TIMEOUT = "GATE_TIMEOUT";

    private resolveBodyCreateOrder: ((value: { bodyText: string }) => void) | null = null;
    private timer: NodeJS.Timeout | null = null;

    private isDisableApiPosition = false;
    private lastPositionsBody: string | null = null;

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

        const entry: WorkerEntry = {
            uid,
            worker: new Worker(workerPath),
            attached: false,
        };
        this.entries.set(uid, entry);
        this.mainLog.info(`3) ✅ [WorkerManager]New Worker uid=${uid} | threadId= ${entry.worker.threadId} | PID=${process.pid}`);

        // === Lắng nghe từ worker ===
        entry.worker.on("message", async (msg: any) => {
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

                    await this.createGateViewForUid(uid, isDebug);

                    this.interceptRequest(uid);

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
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send(msg.type, withUid);
                    } else {
                        this.workerLog.error(`[uid=${uid}] mainWindow not found`);
                    }
                    break;
                }

                case "bot:fetch": {
                    const { url, init, reqId } = msg.payload;
                    const type = "bot:fetch:res";
                    try {
                        const timeoutMs = 5_000;

                        const webContentsViewGate = this.entries.get(uid)?.webContentsViewGate;
                        if (!webContentsViewGate) {
                            const payload: TGateOrderMainRes = {
                                ok: false,
                                reqOrderId: reqId,
                                bodyText: "",
                                error: "webContentsViewGate not found",
                            };
                            entry.worker.postMessage({ type: type, payload: payload });
                            return;
                        }

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
                        const result: TFectMainRes = await webContentsViewGate.webContents.executeJavaScript(js, true);

                        if (result.ok === false && result.error) throw new Error(result.error);

                        entry.worker.postMessage({ type: type, payload: { ok: true, reqId, bodyText: result?.bodyText, error: null } });
                    } catch (e: any) {
                        const msg = String(e?.message || e);
                        const looksTimeout = /\btime(?:d\s+)?out\b/i.test(msg) || e?.name === "AbortError" || e?.code === "ETIMEDOUT";
                        entry.worker.postMessage({
                            type: type,
                            payload: { ok: false, reqId, bodyText: "", error: looksTimeout ? this.GATE_TIMEOUT : msg },
                        });
                    }
                    break;
                }

                case "bot:order": {
                    const { payloadOrder: payloadOrderRaw, selector, reqOrderId } = msg?.payload;
                    const type = "bot:order:res";
                    try {
                        const webContentsViewGate = this.entries.get(uid)?.webContentsViewGate;
                        if (!webContentsViewGate) {
                            const payload: Omit<TGateOrderMainRes, "bodyText"> & { body: null } = {
                                ok: false,
                                reqOrderId: reqOrderId,
                                body: null,
                                error: "webContentsViewGate not found",
                            };
                            entry.worker.postMessage({ type: type, payload: payload });
                            return;
                        }

                        this.payloadOrder = payloadOrderRaw;

                        // Tạo promise chờ API order
                        const waitOrder = this.waitForOneRequest();

                        // Thực hiện click (trả về khi JS của bạn xong, không phải khi API xong)
                        const js = createCodeStringClickOrder(selector);
                        const resultClick: TResultClickOpenOrder = await webContentsViewGate.webContents.executeJavaScript(js, true);
                        if (resultClick.ok === false && resultClick.error) {
                            throw new Error(resultClick.error);
                        }

                        // Chờ API xong, lấy body
                        const bodyText = await waitOrder;

                        let parsed: TGateApiRes<TOrderOpen | null>;
                        try {
                            parsed = JSON.parse(bodyText) as TGateApiRes<TOrderOpen | null>;
                        } catch (e) {
                            throw new Error(`Invalid JSON from Order: ${String(e)}`);
                        }

                        // console.log("parsed", parsed);
                        if (parsed.data === null) {
                            throw new Error(`Order fail: ${parsed.message}`);
                        } else {
                            if (parsed.data.tif === "ioc") {
                                // nếu left là 0 nghĩa là fill hết
                                if (parsed.data.left === 0) {
                                    this.isDisableApiPosition = false;
                                } else {
                                    this.isDisableApiPosition = true;
                                }
                            }
                        }

                        const payload: Omit<TGateOrderMainRes, "bodyText"> & { body: TGateApiRes<TOrderOpen | null> } = {
                            ok: true,
                            reqOrderId,
                            body: parsed,
                            error: null,
                        };

                        entry.worker.postMessage({ type: type, payload: payload });
                    } catch (e: any) {
                        const payload: Omit<TGateOrderMainRes, "bodyText"> & { body: null } = {
                            ok: false,
                            reqOrderId: reqOrderId,
                            body: null,
                            error: String(e?.message || e),
                        };
                        entry.worker.postMessage({ type: type, payload: payload });
                    }
                    break;
                }

                case "bot:clickTabOpenOrder": {
                    const { reqClickTabOpenOrderId, stringClickTabOpenOrder } = msg?.payload;
                    const type = "bot:clickTabOpenOrder:res";
                    try {
                        const webContentsViewGate = this.entries.get(uid)?.webContentsViewGate;
                        if (!webContentsViewGate) {
                            const payload: TGateOrderMainRes = {
                                ok: false,
                                reqOrderId: reqClickTabOpenOrderId,
                                bodyText: "",
                                error: "webContentsViewGate not found",
                            };
                            entry.worker.postMessage({ type: type, payload: payload });
                            return;
                        }

                        const result: TResultClickTabOpenOrder = await webContentsViewGate.webContents.executeJavaScript(
                            stringClickTabOpenOrder,
                            true,
                        );

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClickTabOpenOrderRes = {
                            ok: true,
                            body: result.data,
                            reqClickTabOpenOrderId: reqClickTabOpenOrderId,
                            error: null,
                        };

                        entry.worker.postMessage({ type: type, payload: payload });
                    } catch (e: any) {
                        const payload: TGateClickTabOpenOrderRes = {
                            ok: false,
                            body: null,
                            reqClickTabOpenOrderId: reqClickTabOpenOrderId,
                            error: String(e?.message || e),
                        };
                        entry.worker.postMessage({ type: type, payload: payload });
                    }
                    break;
                }

                case "bot:clickCanelAllOpen": {
                    const { reqClickCanelAllOpenOrderId, stringClickCanelAllOpen } = msg?.payload;
                    const type = "bot:clickCanelAllOpen:res";

                    try {
                        const webContentsViewGate = this.entries.get(uid)?.webContentsViewGate;
                        if (!webContentsViewGate) {
                            const payload: TGateOrderMainRes = {
                                ok: false,
                                reqOrderId: reqClickCanelAllOpenOrderId,
                                bodyText: "",
                                error: "webContentsViewGate not found",
                            };
                            entry.worker.postMessage({ type: type, payload: payload });
                            return;
                        }

                        const result: TResultClickCancelOpen = await webContentsViewGate.webContents.executeJavaScript(stringClickCanelAllOpen, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClickCancelAllOpenRes = {
                            ok: result.ok,
                            body: result.data,
                            reqClickCanelAllOpenOrderId: reqClickCanelAllOpenOrderId,
                            error: null,
                        };

                        entry.worker.postMessage({ type: type, payload: payload });
                    } catch (e: any) {
                        const payload: TGateClickCancelAllOpenRes = {
                            ok: false,
                            body: null,
                            reqClickCanelAllOpenOrderId: reqClickCanelAllOpenOrderId,
                            error: String(e?.message || e),
                        };
                        entry.worker.postMessage({ type: type, payload: payload });
                    }
                    break;
                }

                case "bot:reloadWebContentsView:Request": {
                    try {
                        const webContentsViewGate = this.entries.get(uid)?.webContentsViewGate;
                        if (!webContentsViewGate) {
                            this.mainLog.error(`bot:reloadWebContentsView:Request: webContentsViewGate not found`);
                            return;
                        }

                        await this.reloadAndWait(webContentsViewGate, entry.worker, 30000);
                        webContentsViewGate.webContents.executeJavaScript(setLocalStorageScript, true);
                        webContentsViewGate.webContents.executeJavaScript(codeStringKillMantineToasts, true);
                        webContentsViewGate.webContents.executeJavaScript(codeStringCloseAnnouncements, true);

                        entry.worker.postMessage({ type: "bot:reloadWebContentsView:Response", payload: msg?.payload });
                    } catch (e) {
                        // log lỗi reload nếu cần
                        this.mainLog.error(`bot:reloadWebContentsView:Request: ${e}`);
                    }
                    break;
                }

                case "bot:clickMarketPosition": {
                    const { reqClickMarketPositionId, stringClickMarketPosition } = msg?.payload;
                    const type = "bot:clickMarketPosition:res";
                    try {
                        const webContentsViewGate = this.entries.get(uid)?.webContentsViewGate;
                        if (!webContentsViewGate) {
                            const payload: TGateOrderMainRes = {
                                ok: false,
                                reqOrderId: reqClickMarketPositionId,
                                bodyText: "",
                                error: "webContentsViewGate not found",
                            };
                            entry.worker.postMessage({ type: type, payload: payload });
                            return;
                        }

                        const result: TResultClickMarketPosition = await webContentsViewGate.webContents.executeJavaScript(
                            stringClickMarketPosition,
                            true,
                        );

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        this.isDisableApiPosition = false;

                        const payload: TGateClickMarketPositionRes = {
                            ok: result.ok,
                            body: result.data,
                            reqClickMarketPositionId: reqClickMarketPositionId,
                            error: null,
                        };

                        entry.worker.postMessage({ type: type, payload: payload });
                    } catch (e: any) {
                        const payload: TGateClickMarketPositionRes = {
                            ok: false,
                            body: null,
                            reqClickMarketPositionId: reqClickMarketPositionId,
                            error: String(e?.message || e),
                        };
                        entry.worker.postMessage({ type: type, payload: payload });
                    }
                    break;
                }

                case "bot:checkLogin": {
                    const { reqCheckLoginId, stringCheckLogin } = msg?.payload;
                    const type = "bot:checkLogin:res";
                    try {
                        const webContentsViewGate = this.entries.get(uid)?.webContentsViewGate;
                        if (!webContentsViewGate) {
                            const payload: TGateOrderMainRes = {
                                ok: false,
                                reqOrderId: reqCheckLoginId,
                                bodyText: "",
                                error: "webContentsViewGate not found",
                            };
                            entry.worker.postMessage({ type: type, payload: payload });
                            return;
                        }

                        const result: TResultClick<boolean> = await webContentsViewGate.webContents.executeJavaScript(stringCheckLogin, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClick<boolean> & { reqCheckLoginId: number } = {
                            ok: result.ok,
                            body: result.data,
                            reqCheckLoginId: reqCheckLoginId,
                            error: null,
                        };

                        entry.worker.postMessage({ type: type, payload: payload });
                    } catch (e: any) {
                        const payload: TGateClick<boolean> & { reqCheckLoginId: number } = {
                            ok: false,
                            body: null,
                            reqCheckLoginId: reqCheckLoginId,
                            error: String(e?.message || e),
                        };
                        entry.worker.postMessage({ type: type, payload: payload });
                    }
                    break;
                }

                case "bot:clickClearAll": {
                    const { reqClickClearAllId, stringClickClearAll } = msg?.payload;
                    const type = "bot:clickClearAll:res";
                    try {
                        const webContentsViewGate = this.entries.get(uid)?.webContentsViewGate;
                        if (!webContentsViewGate) {
                            const payload: TGateOrderMainRes = {
                                ok: false,
                                reqOrderId: reqClickClearAllId,
                                bodyText: "",
                                error: "webContentsViewGate not found",
                            };
                            entry.worker.postMessage({ type: type, payload: payload });
                            return;
                        }

                        const result: TResultClick<boolean> = await webContentsViewGate.webContents.executeJavaScript(stringClickClearAll, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClick<boolean> & { reqClickClearAllId: number } = {
                            ok: result.ok,
                            body: result.data,
                            reqClickClearAllId: reqClickClearAllId,
                            error: null,
                        };

                        entry.worker.postMessage({ type: type, payload: payload });
                    } catch (e: any) {
                        const payload: TGateClick<boolean> & { reqClickClearAllId: number } = {
                            ok: false,
                            body: null,
                            reqClickClearAllId: reqClickClearAllId,
                            error: String(e?.message || e),
                        };
                        entry.worker.postMessage({ type: type, payload: payload });
                    }
                    break;
                }

                case "bot:getUid": {
                    const { reqGetUidId, stringGetUid } = msg?.payload;
                    const type = "bot:getUid:res";
                    try {
                        const webContentsViewGate = this.entries.get(uid)?.webContentsViewGate;
                        if (!webContentsViewGate) {
                            const payload: TGateOrderMainRes = {
                                ok: false,
                                reqOrderId: reqGetUidId,
                                bodyText: "",
                                error: "webContentsViewGate not found",
                            };
                            entry.worker.postMessage({ type: type, payload: payload });
                            return;
                        }

                        const result: TResultClick<string | null> = await webContentsViewGate.webContents.executeJavaScript(stringGetUid, true);

                        if (result.ok === false && result.error) {
                            throw new Error(result.error);
                        }

                        const payload: TGateClick<string | null> & { reqGetUidId: number } = {
                            ok: result.ok,
                            body: result.data,
                            reqGetUidId: reqGetUidId,
                            error: null,
                        };

                        entry.worker.postMessage({ type: type, payload: payload });
                    } catch (e: any) {
                        const payload: TGateClick<string> & { reqGetUidId: number } = {
                            ok: false,
                            body: null,
                            reqGetUidId: reqGetUidId,
                            error: String(e?.message || e),
                        };
                        entry.worker.postMessage({ type: type, payload: payload });
                    }

                    break;
                }
            }
        });

        entry.worker.on("error", (err) => {
            this.workerLog.error(`[WorkerManager] worker error uid=${uid}`, err);
        });

        entry.worker.on("exit", (code) => {
            this.workerLog.error(`[WorkerManager] worker exit uid=${uid} code=${code}`);
            // dọn map + view
            // this.destroyOne(uid);
            // báo renderer
            this.mainWindow?.webContents.send("worker:exit", { uid, code });
        });

        entry.worker.once("online", () => {
            this.mainLog.info(`4) ✅ [WorkerManager] Worker Online uid=${uid}`);
            const payloadInit: Omit<TDataInitBot, "parentPort"> = {
                ...initBase,
                uidDB: uid,
            };
            entry.worker.postMessage({ type: "bot:init", payload: payloadInit });
            this.mainLog.info(`5) ✅ [WorkerManager] bot:init sent | uid=${uid} | threadId=${entry.worker?.threadId}`);
        });

        // lắng nghe từ rerender
        ipcMain.on("bot:start", (event, data) => {
            entry.worker.postMessage({ type: "bot:start", payload: data });
        });
        ipcMain.on("bot:stop", (event, data) => {
            entry.worker.postMessage({ type: "bot:stop", payload: data });
        });
        ipcMain.on("bot:reloadWebContentsView", (event, data) => {
            entry.worker.postMessage({ type: "bot:reloadWebContentsView", payload: data });
        });
        ipcMain.on("bot:setWhiteList", (event, data) => {
            entry.worker.postMessage({ type: "bot:setWhiteList", payload: data });
        });
        ipcMain.on("bot:settingUser", (event, data) => {
            entry.worker.postMessage({ type: "bot:settingUser", payload: data });
        });
        ipcMain.on("bot:uiSelector", (event, data) => {
            entry.worker.postMessage({ type: "bot:uiSelector", payload: data });
        });
        ipcMain.on("bot:blackList", (event, data) => {
            entry.worker.postMessage({ type: "bot:blackList", payload: data });
        });
        ipcMain.on("bot:rateMax:set", (event, data) => {
            entry.worker.postMessage({ type: "bot:rateMax:set", payload: data });
        });
        ipcMain.on("bot:takeProfitAccount", (event, data) => {
            entry.worker.postMessage({ type: "bot:takeProfitAccount", payload: data });
        });
        ipcMain.on("bot:removeFixStopLossQueue", (event, data) => {
            entry.worker.postMessage({ type: "bot:removeFixStopLossQueue", payload: data });
        });
        ipcMain.on("bot:ioc:long", (event, data) => {
            entry.worker.postMessage({ type: "bot:ioc:long", payload: data });
        });
        ipcMain.on("bot:ioc:short", (event, data) => {
            entry.worker.postMessage({ type: "bot:ioc:short", payload: data });
        });
        ipcMain.on("bot:ioc:hedge", (event, data) => {
            entry.worker.postMessage({ type: "bot:ioc:hedge", payload: data });
        });
        ipcMain.on("bot:ioc:oneway", (event, data) => {
            entry.worker.postMessage({ type: "bot:ioc:oneway", payload: data });
        });
        ipcMain.on("bot:whiteListMartingale", (event, data) => {
            entry.worker.postMessage({ type: "bot:whiteListMartingale", payload: data });
        });
        ipcMain.on("bot:whiteListFarmIoc", (event, data) => {
            entry.worker.postMessage({ type: "bot:whiteListFarmIoc", payload: data });
        });
        ipcMain.on("bot:whiteListScalpIoc", (event, data) => {
            entry.worker.postMessage({ type: "bot:whiteListScalpIoc", payload: data });
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
        if (entry.webContentsViewGate) {
            const webcontents = entry.webContentsViewGate.webContents;

            // (a) Tháo khỏi cây view để giải phóng liên kết layout/render
            try {
                this.mainWindow.contentView.removeChildView(entry.webContentsViewGate);
                this.sendIsChildView(false);
            } catch {}

            // (b) Dọn dẹp phụ trợ trước khi close
            try {
                if (webcontents.isDevToolsOpened()) webcontents.closeDevTools();
            } catch {}
            try {
                webcontents.stop();
            } catch {}
            try {
                webcontents.removeAllListeners();
            } catch {}
            try {
                if (entry.layoutGateView) {
                    this.mainWindow.removeListener("resize", entry.layoutGateView);
                }
            } catch {}

            // (c) Đóng và CHỜ 'destroyed'
            await new Promise<void>((resolve) => {
                if (webcontents.isDestroyed()) return resolve();

                const timer = setTimeout(() => {
                    this.mainLog.warn(`[WorkerManager] webContents close timed out uid=${uid}`);
                    resolve(); // fallback
                }, 3000);

                webcontents.once("destroyed", () => {
                    clearTimeout(timer);
                    resolve();
                });

                // Bỏ qua beforeunload để không bị chặn
                try {
                    webcontents.close({ waitForBeforeUnload: false });
                } catch {
                    clearTimeout(timer);
                    resolve();
                }
            });

            this.mainLog.info(`gateView uid=${uid} destroyed=${webcontents.isDestroyed()}`);
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

    private async createGateViewForUid(uid: number, isDebug: boolean) {
        const entry = this.entries.get(uid);
        if (!entry) {
            this.mainLog.error(`${uid}: Not found entry to create gate view`);
            return;
        }

        // Tạo WebContentsView riêng theo uid với session/partition tách biệt
        const partition = `persist:gate${uid}`;
        entry.webContentsViewGate = new WebContentsView({
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

        this.mainWindow.contentView.addChildView(entry.webContentsViewGate);
        this.sendIsChildView(true);

        entry.attached = true;

        entry.layoutGateView = () => {
            if (this.mainWindow.isDestroyed()) return;

            for (const [uid, data] of this.entries) {
                if (!data.webContentsViewGate) continue;
                const { width, height } = this.mainWindow.getContentBounds();
                data.webContentsViewGate.setBounds({
                    x: 0,
                    y: this.TOP_PANEL,
                    width: Math.max(0, width),
                    height: Math.max(0, height - this.TOP_PANEL),
                });
            }
        };
        entry.layoutGateView();
        this.mainWindow.on("resize", entry.layoutGateView);

        entry.webContentsViewGate.webContents.setWindowOpenHandler(({ url }) => {
            // mở popup ngoài app
            shell.openExternal(url);
            return { action: "deny" };
        });

        // load trang Gate
        await entry.webContentsViewGate.webContents.loadURL("https://www.gate.com/futures/USDT/BTC_USDT");
        entry.webContentsViewGate.webContents.executeJavaScript(setLocalStorageScript, true);
        entry.webContentsViewGate.webContents.executeJavaScript(codeStringKillMantineToasts, true);
        entry.webContentsViewGate.webContents.executeJavaScript(codeStringCloseAnnouncements, true);

        if (!IS_PRODUCTION) {
            if (isDebug) {
                entry.webContentsViewGate.webContents.openDevTools({ mode: "detach" });
            }
        }
    }

    private attachView(uid: number) {
        const rec = this.entries.get(uid);
        if (!rec || !rec.webContentsViewGate || rec.attached) return;

        this.mainWindow.contentView.addChildView(rec.webContentsViewGate);
        this.sendIsChildView(true);

        rec.attached = true;
    }

    private detachView(uid: number) {
        const rec = this.entries.get(uid);
        if (!rec || !rec.webContentsViewGate || rec.attached) return;

        try {
            this.mainWindow.contentView.removeChildView(rec.webContentsViewGate);
            this.sendIsChildView(false);
        } catch {}

        rec.attached = false;
    }

    private toggleGateView(uid: number): boolean {
        let rec = this.entries.get(uid);
        if (rec) {
            if (rec.attached) {
                this.detachView(uid);
                return false; // đang tắt
            } else {
                this.attachView(uid);
                return true; // đang bật
            }
        }
        return false;
        // console.log("toggleGateView", uid, rec?.gateView?.attached);
    }

    private sendIsChildView(isChildView: boolean) {
        this.mainWindow.webContents.send("bot:isChildView", { isChildView });
    }

    private waitForOneRequest(timeoutMs = 8000): Promise<string> {
        return new Promise((resolve, reject) => {
            this.resolveBodyCreateOrder = resolve as any;
            this.timer = setTimeout(() => {
                if (this.timer) clearTimeout(this.timer);
                reject(new Error(`waitForOneRequest ${this.GATE_TIMEOUT}`));
            }, timeoutMs);
        });
    }

    private async reloadAndWait(gateView: Electron.WebContentsView, botWorker: import("worker_threads").Worker, timeoutMs = 30000) {
        const webContent = gateView.webContents;

        return new Promise<void>((resolve, reject) => {
            let timer: NodeJS.Timeout;

            const cleanup = () => {
                clearTimeout(timer);
                webContent.off("did-finish-load", onDone);
                webContent.off("did-fail-load", onFail);
                webContent.off("render-process-gone", onGone);
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
            webContent.once("did-finish-load", onDone);
            webContent.once("did-fail-load", onFail);
            webContent.once("render-process-gone", onGone);

            webContent.reload(); // hoặc reloadIgnoringCache()
        });
    }

    private interceptRequest(uid: number) {
        const entry = this.entries.get(uid);
        if (!entry) {
            this.mainLog.error(`${uid}: Not found entry to interceptRequest`);
            return;
        }

        if (!entry.webContentsViewGate) {
            this.mainLog.error(`${uid}: Not found webContentsViewGate to interceptRequest`);
            return;
        }

        const webContents = entry.webContentsViewGate.webContents;

        // Attach debugger 1 lần
        if (!webContents.debugger.isAttached()) {
            // pattern riêng cho lấy body khi nhận phản hồi
            const responsePatterns = Object.values(this.FLOWS_API).map((item) => ({
                urlPattern: item.url, // match EXACT url
                requestStage: "Response",
                resourceType: "XHR",
            }));

            // pattern riêng cho sửa payload (POST /orders) – để nguyên logic sửa
            const requestPatterns = Object.values(this.REQUEST_API).map((item) => ({
                urlPattern: item.url, // match EXACT url
                requestStage: "Request",
                resourceType: "XHR",
            }));

            webContents.debugger.attach("1.3"); // version protocol
            // webContents.debugger.sendCommand("Network.enable");
            webContents.debugger.sendCommand("Fetch.enable", {
                patterns: [
                    // sửa payload order
                    ...requestPatterns,
                    // lấy body khi nhận phản hồi (khỏi cần Network.*)
                    ...responsePatterns,
                ],
            });
        }

        webContents.debugger.on("message", async (_e, cdpMethod, params: any) => {
            if (cdpMethod !== "Fetch.requestPaused") return;

            const { requestId, request, responseStatusCode } = params;
            const url = String(request?.url || "");
            const reqMethod = String(request?.method || "");

            // --- PHA RESPONSE: chỉ đọc body khi KHỚP CHÍNH XÁC method + url theo FLOWS_API ---
            if (responseStatusCode !== undefined) {
                const isAccounts = reqMethod === this.FLOWS_API.acounts.method && url === this.FLOWS_API.acounts.url;
                const isPositions = reqMethod === this.FLOWS_API.positions.method && url === this.FLOWS_API.positions.url;
                const isOrdersGet = reqMethod === this.FLOWS_API.orders.method && url === this.FLOWS_API.orders.url;
                const isOrdersPost = reqMethod === this.FLOWS_API.createOrders.method && url === this.FLOWS_API.createOrders.url;

                if (isAccounts || isPositions || isOrdersGet || isOrdersPost) {
                    try {
                        const { body, base64Encoded } = await webContents.debugger.sendCommand("Fetch.getResponseBody", { requestId });
                        const bodyText = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;

                        if (isOrdersPost) {
                            this.resolveBodyCreateOrder?.(bodyText); // resolve string
                            if (this.timer) clearTimeout(this.timer);
                            this.resolveBodyCreateOrder = null;
                        } else {
                            if (isPositions) this.lastPositionsBody = bodyText;

                            const valueFollowApi: TWorkerData<TPayloadFollowApi> = {
                                type: "bot:followApi",
                                payload: { method: reqMethod, url, status: responseStatusCode, bodyText },
                            };
                            entry.worker.postMessage(valueFollowApi);
                        }
                    } catch (e) {
                        // đọc body lỗi thì vẫn cho qua request
                    }
                }

                await webContents.debugger.sendCommand("Fetch.continueRequest", { requestId });
                return;
            }

            // --- PHA REQUEST: GIỮ NGUYÊN SỬA PAYLOAD CHO POST /orders ---
            // Lưu ý: vẫn dùng startsWith để cover trường hợp sau này có query / v2 thay đổi nhẹ
            if (reqMethod === this.REQUEST_API.orders.method && url === this.REQUEST_API.orders.url) {
                try {
                    const obj = JSON.parse(request?.postData ?? "{}");
                    const modified = this.handlePayloadModification(obj, this.payloadOrder); // để nguyên hàm của bạn
                    const postDataB64 = Buffer.from(JSON.stringify(modified), "utf8").toString("base64");
                    await webContents.debugger.sendCommand("Fetch.continueRequest", { requestId, postData: postDataB64 });
                } catch {
                    // Nếu parse/sửa lỗi -> cứ cho request đi thẳng
                    await webContents.debugger.sendCommand("Fetch.continueRequest", { requestId });
                }
                return;
            }

            // --- REQUEST: CHẶN/FAKE GET /positions khi IOC fill ---
            if (reqMethod === this.REQUEST_API.positions.method && url === this.REQUEST_API.positions.url) {
                if (this.isDisableApiPosition) {
                    // Khuyến nghị: fulfill 200 + body rỗng/cached → UI không lỗi, request hoàn tất ngay
                    const bodyText = this.lastPositionsBody ?? JSON.stringify({
                        code: 200,
                        data: [],
                        message: "success",
                        method: "/apiw/v2/futures/usdt/positions",
                    }); // hoặc body gần nhất, hoặc "[]"
                    await webContents.debugger.sendCommand("Fetch.fulfillRequest", {
                        requestId,
                        responseCode: 200,
                        responseHeaders: [{ name: "Content-Type", value: "application/json" }],
                        body: Buffer.from(bodyText, "utf8").toString("base64"),
                    });
                    return; // ĐÃ xử lý xong
                }
            }

            // Các request khác: cho đi thẳng
            await webContents.debugger.sendCommand("Fetch.continueRequest", { requestId });
        });

        // Khi window đóng, nên detach
        entry.webContentsViewGate.webContents.once("destroyed", () => {
            try {
                webContents.debugger.detach();
            } catch {}
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
