// src/main/workers/init.worker.ts
import { codeStringKillMantineToasts, createCodeStringClickOrder, setLocalStorageScript } from "@/javascript-string/logic-farm";
import {
    TFectMainRes,
    TGateClickCancelAllOpenRes,
    TGateClickTabOpenOrderRes,
    TGateFectMainRes,
    TGateOrderMainRes,
    TPayloadFollowApi,
    TPayloadOrder,
    TResultClickCancelOpen,
    TResultClickOpenOrder,
    TResultClickTabOpenOrder,
} from "@/types/bot.type";
import { TWorkerData, TWorkLog } from "@/types/worker.type";
import { app, BrowserWindow, Event, ipcMain, RenderProcessGoneDetails, WebContentsView } from "electron";
import Logger from "electron-log";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { GateRateCounter } from "../endpoint-counter";
import { initGateView } from "../gate/gate-view";

export const GATE_TIMEOUT = "GATE_TIMEOUT";

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

if (!isDebug) {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
    console.trace = () => {};
}

let botWorker: Worker | null = null;
let gateView: WebContentsView | undefined;
const endpointCounter = new GateRateCounter("endpoint-counts.json"); // true = kèm host
// const { broadcast: broadcastRate } = setupRateIpc(endpointCounter);

let payloadOrder: TPayloadOrder = {
    contract: "BTC_USDT",
    price: "100095.0",
    reduce_only: false,
    size: "1",
};

export function initBot(mainWindow: BrowserWindow, mainLog: Logger.LogFunctions, workerLog: Logger.LogFunctions) {
    if (!botWorker) {
        const workerPath = app.isPackaged
            ? path.join(process.resourcesPath, "app.asar.unpacked", "dist", "main", "workers", "bot.worker.js")
            : path.join(__dirname, "workers", "bot.worker.bundle.dev.js");

        botWorker = new Worker(workerPath);
        mainLog.info("New Worker | threadId: ", botWorker.threadId);

        ipcMain.on("bot:init", (event, data) => {
            botWorker?.postMessage({ type: "bot:init", payload: data });
            mainLog.info("1) bot:init - send  | threadId ", botWorker?.threadId);
        });

        // lắng nghe từ worker
        botWorker.on("message", async (msg) => {
            if (msg?.type === "bot:log") {
                const { level = "info", text = "" }: TWorkLog = msg.payload;
                // map level cơ bản
                if (level === "error") workerLog.error(text);
                else if (level === "warn") workerLog.warn(text);
                else if (level === "debug") workerLog.debug?.(text);
                else workerLog.info(text);
            }
            if (msg?.type === "bot:init:done") {
                mainLog.info("3) bot:init:done");
                gateView = initGateView(mainWindow, isDebug);
                interceptRequest(gateView, botWorker!);
            }
            if (msg?.type === "bot:heartbeat") {
                // mainLog.info("bot:heartbeatbot:heartbeatbot:heartbeatbot:heartbeatbot:heartbeatbot:heartbeat");
                mainWindow?.webContents.send("bot:heartbeat", msg);
            }
            if (msg?.type === "bot:metrics") {
                mainWindow?.webContents.send("bot:metrics", msg);
            }
            if (msg?.type === "bot:start") {
                mainWindow?.webContents.send("bot:start", msg);
            }
            if (msg?.type === "bot:stop") {
                mainWindow?.webContents.send("bot:stop", msg);
            }
            if (msg?.type === "bot:reloadWebContentsView") {
                mainWindow?.webContents.send("bot:reloadWebContentsView", msg);
            }
            if (msg?.type === "bot:isReady") {
                mainWindow?.webContents.send("bot:isReady", msg);
            }
            if (msg?.type === "bot:fetch") {
                const { url, init, reqId } = msg.payload;

                const timeoutMs = 5_000;

                try {
                    if (!gateView) {
                        throw new Error("gateView not found");
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
                                return { ok: false, bodyText: '', error: '${GATE_TIMEOUT}' };
                            }
                            return { ok: false, bodyText: '', error: String(e && e.message || e) };
                        } finally {
                            clearTimeout(to);
                        }
                    })()
                    `;

                    const result: TFectMainRes = await gateView.webContents.executeJavaScript(js, true);

                    if (result.ok === false && result.error) {
                        throw new Error(result.error);
                    }

                    const payload: TGateFectMainRes = {
                        ok: true,
                        reqId,
                        bodyText: result?.bodyText,
                        error: null,
                    };

                    botWorker?.postMessage({ type: "bot:fetch:res", payload });
                } catch (e: any) {
                    const msg = String(e?.message || e);
                    const looksTimeout = /\btime(?:d\s+)?out\b/i.test(msg) || e?.name === "AbortError" || e?.code === "ETIMEDOUT";
                    const payload: TGateFectMainRes = {
                        ok: false,
                        reqId,
                        bodyText: "",
                        error: looksTimeout ? GATE_TIMEOUT : msg, // <-- chuẩn hoá thêm lần nữa
                    };
                    botWorker?.postMessage({ type: "bot:fetch:res", payload });
                }
            }
            if (msg?.type === "bot:order") {
                if (!gateView) return;
                const { payloadOrder: payloadOrderRaw, selector, reqOrderId } = msg?.payload;
                const tag = `O${reqOrderId}`;
                try {
                    payloadOrder = payloadOrderRaw;

                    // Tạo promise chờ API order
                    const waitOrder = waitForOneRequest(
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

                    botWorker?.postMessage({ type: "bot:order:res", payload: payload });
                } catch (e: any) {
                    const payload: TGateOrderMainRes = {
                        ok: false,
                        reqOrderId: reqOrderId,
                        bodyText: "",
                        error: String(e?.message || e),
                    };
                    botWorker?.postMessage({ type: "bot:order:res", payload: payload });
                }
            }
            if (msg?.type === "bot:clickTabOpenOrder") {
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

                    botWorker?.postMessage({ type: "bot:clickTabOpenOrder:res", payload: payload });
                } catch (e: any) {
                    const payload: TGateClickTabOpenOrderRes = {
                        ok: false,
                        body: null,
                        reqClickTabOpenOrderId: reqClickTabOpenOrderId,
                        error: String(e?.message || e),
                    };
                    botWorker?.postMessage({ type: "bot:clickTabOpenOrder:res", payload: payload });
                }
            }
            if (msg?.type === "bot:clickCanelAllOpen") {
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

                    botWorker?.postMessage({ type: "bot:clickCanelAllOpen:res", payload: payload });
                } catch (e: any) {
                    const payload: TGateClickCancelAllOpenRes = {
                        ok: false,
                        body: null,
                        reqClickCanelAllOpenOrderId: reqClickCanelAllOpenOrderId,
                        error: String(e?.message || e),
                    };
                    botWorker?.postMessage({ type: "bot:clickCanelAllOpen:res", payload: payload });
                }
            }
            if (msg?.type === "bot:sticky:set") {
                mainWindow?.webContents.send("bot:sticky:set", msg.payload);
            }
            if (msg?.type === "bot:sticky:remove") {
                mainWindow?.webContents.send("bot:sticky:remove", msg.payload);
            }
            if (msg?.type === "bot:sticky:clear") {
                mainWindow?.webContents.send("bot:sticky:clear", msg.payload);
            }
            if (msg?.type === "bot:reloadWebContentsView:Request") {
                if (!gateView) {
                    mainLog.error("bot:reloadWebContentsView:Request: gateView not found");
                    return;
                }

                try {
                    if (!botWorker) {
                        throw new Error("bot:reloadWebContentsView:Request: botWorker not found");
                    }

                    await reloadAndWait(gateView, botWorker, 30000);
                    // re-inject mọi thứ cần chạy lại sau reload
                    gateView.webContents.executeJavaScript(setLocalStorageScript, true).catch(() => {});
                    gateView.webContents.executeJavaScript(codeStringKillMantineToasts, true).catch(() => {});
                    // (nếu có) re-enable các patch WS / CDP, v.v.

                    botWorker?.postMessage({ type: "bot:reloadWebContentsView:Response", payload: msg?.payload });
                } catch (e) {
                    // log lỗi reload nếu cần
                    workerLog.error(`bot:reloadWebContentsView:Request: ${e}`);
                }
            }
            if (msg?.type === "bot:rateCounter") {
                mainWindow?.webContents.send("bot:rateCounter", msg);
            }
        });
        botWorker.on("error", (err) => {
            workerLog.error(err);
        });
        botWorker.on("exit", (code) => {
            workerLog.error(`bot exited code: ${code}, need to reload app`);
            botWorker = null;
        });
        botWorker.once("online", () => {
            workerLog.info(`Worker Online`);
        });

        // lắng nghe từ rerender
        ipcMain.on("bot:start", (event, data) => {
            botWorker?.postMessage({ type: "bot:start", payload: data });
        });
        ipcMain.on("bot:stop", (event, data) => {
            botWorker?.postMessage({ type: "bot:stop", payload: data });
        });
        ipcMain.on("bot:reloadWebContentsView", (event, data) => {
            botWorker?.postMessage({ type: "bot:reloadWebContentsView", payload: data });
        });
        ipcMain.on("bot:setWhiteList", (event, data) => {
            botWorker?.postMessage({ type: "bot:setWhiteList", payload: data });
        });
        ipcMain.on("bot:settingUser", (event, data) => {
            botWorker?.postMessage({ type: "bot:settingUser", payload: data });
        });
        ipcMain.on("bot:uiSelector", (event, data) => {
            botWorker?.postMessage({ type: "bot:uiSelector", payload: data });
        });
        ipcMain.on("bot:blackList", (event, data) => {
            botWorker?.postMessage({ type: "bot:blackList", payload: data });
        });
        ipcMain.on("bot:rateMax:set", (event, data) => {
            botWorker?.postMessage({ type: "bot:rateMax:set", payload: data });
        });
        ipcMain.handle("devtools:toggle", () => {
            if (!gateView) return { ok: false, opened: false, error: "gateView not found" };
            if (gateView.webContents.isDevToolsOpened()) {
                gateView.webContents.closeDevTools();
                return { ok: true, opened: false };
            } else {
                gateView.webContents.openDevTools({ mode: "detach" });
                return { ok: true, opened: true };
            }
        });
    }

    return botWorker!;
}

const FLOWS_API = {
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

export function interceptRequest(gateView: WebContentsView, botWorker: import("worker_threads").Worker) {
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

                                const modified = handlePayloadModification(obj, {
                                    contract: payloadOrder.contract,
                                    price: payloadOrder.price,
                                    reduce_only: payloadOrder.reduce_only,
                                    size: payloadOrder.size,
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
                        case `${FLOWS_API.acounts.method} ${FLOWS_API.acounts.url}`:
                            tracked.set(reqId, { method, url });
                            break;
                        case `${FLOWS_API.orders.method} ${FLOWS_API.orders.url}`:
                            tracked.set(reqId, { method, url });
                            break;
                        case `${FLOWS_API.positions.method} ${FLOWS_API.positions.url}`:
                            tracked.set(reqId, { method, url });
                            break;
                        default:
                            break;
                    }

                    endpointCounter.bumpFromHttp(method, url);
                    // broadcastRate();

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
                        case `${FLOWS_API.acounts.method} ${FLOWS_API.acounts.url}`:
                            botWorker?.postMessage(valueFollowApi);
                            break;
                        case `${FLOWS_API.orders.method} ${FLOWS_API.orders.url}`:
                            botWorker?.postMessage(valueFollowApi);
                            break;
                        case `${FLOWS_API.positions.method} ${FLOWS_API.positions.url}`:
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

function handlePayloadModification(data: any, dataModify: any) {
    if (data?.order_type === "market") {
        console.info({ "Lệnh thanh lý market bỏ qua": data });
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

// chờ đúng 1 request (POST + URL), với log & timeout riêng
function waitForOneRequest(
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
            finish(false, `waitForOneRequest ${GATE_TIMEOUT}`);
            clean();
            reject(new Error(`waitForOneRequest ${GATE_TIMEOUT}`));
        }, timeoutMs);
    });
}

async function reloadAndWait(gateView: Electron.WebContentsView, botWorker: import("worker_threads").Worker, timeoutMs = 30000) {
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

async function applyNoThrottle(dbg: Electron.Debugger): Promise<void> {
    try {
        await dbg.sendCommand("Network.enable");
        await dbg.sendCommand("Network.setCacheDisabled", { cacheDisabled: false });

        // Ép No throttling (Network)
        await dbg.sendCommand("Network.emulateNetworkConditions", {
            offline: false,
            latency: 0,
            downloadThroughput: 0,
            uploadThroughput: 0,
        });

        // Ép No throttling (CPU)
        await dbg.sendCommand("Emulation.setCPUThrottlingRate", { rate: 1 });

        console.log("[applyNoThrottle] done");
    } catch (e) {
        console.error("[applyNoThrottle]", e);
    }
}
