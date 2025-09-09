// src/main/workers/init.worker.ts
import { LogLine } from "@/components/terminal-log/terminal-log";
import { createCodeStringClickOrder } from "@/javascript-string/logic-farm";
import {
    TFectMainRes,
    TGateClickCancelAllOpenRes,
    TGateClickTabOpenOrderRes,
    TGateFectMainRes,
    TGateOrderMainRes,
    TPayloadOrder,
    TResultClickCancelOpen,
    TResultClickOpenOrder,
    TResultClickTabOpenOrder,
} from "@/types/bot.type";
import { app, BrowserWindow, ipcMain, WebContentsView } from "electron";
import path from "node:path";
import { Worker } from "node:worker_threads";

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

if (!isDebug) {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
    console.trace = () => {};
}

let botWorker: Worker | null = null;

let payloadOrder: TPayloadOrder = {
    contract: "BTC_USDT",
    price: "100095.0",
    reduce_only: false,
    size: "1",
};

export function initBot(mainWindow: BrowserWindow | null, gateView: WebContentsView) {
    if (!botWorker) {
        const workerPath = app.isPackaged
            ? path.join(process.resourcesPath, "app.asar.unpacked", "dist", "main", "workers", "bot.worker.js")
            : path.join(__dirname, "workers", "bot.worker.bundle.dev.js");

        botWorker = new Worker(workerPath);

        interceptRequest(gateView);

        botWorker.on("error", (err) => {
            console.error("botWorker error:", err);
            const payload: LogLine = { ts: Date.now(), level: "error", text: `bot error: ${err?.message}` };
            mainWindow?.webContents.send("bot:log", payload);
        });
        botWorker.on("exit", (code) => {
            console.log("botWorker exit:", code);
            const payload: LogLine = { ts: Date.now(), level: "error", text: `bot exited code: ${code}, need to reload app` };
            mainWindow?.webContents.send("bot:log", payload);
            botWorker = null;
        });

        // ⬇️ Chờ thread vào trạng thái online rồi mới gửi init
        botWorker.once("online", () => {});

        // lắng nghe từ rerender
        ipcMain.on("bot:start", (event, data) => {
            botWorker?.postMessage({ type: "bot:start" });
            const payload: LogLine = { ts: Date.now(), level: "info", text: `🟢 Start` };
            mainWindow?.webContents.send("bot:log", payload);
        });
        ipcMain.on("bot:stop", (event, data) => {
            botWorker?.postMessage({ type: "bot:stop" });
            const payload: LogLine = { ts: Date.now(), level: "info", text: `🔴 Stop` };
            mainWindow?.webContents.send("bot:log", payload);
        });
        ipcMain.on("bot:setWhiteList", (event, data) => {
            botWorker?.postMessage({ type: "bot:setWhiteList", payload: data });
        });
        ipcMain.on("bot:init", (event, data) => {
            botWorker?.postMessage({ type: "bot:init", payload: data });
        });
        ipcMain.on("bot:settingUser", (event, data) => {
            botWorker?.postMessage({ type: "bot:settingUser", payload: data });
        });
        ipcMain.on("bot:uiSelector", (event, data) => {
            botWorker?.postMessage({ type: "bot:uiSelector", payload: data });
        });

        // lắng nghe từ worker
        botWorker.on("message", async (msg) => {
            if (msg?.type === "bot:heartbeat") {
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
            if (msg?.type === "bot:isReady") {
                mainWindow?.webContents.send("bot:isReady", msg);
            }
            if (msg?.type === "bot:fetch") {
                const { url, init, reqId } = msg.payload;
                try {
                    const js = `
                    (async () => {
                        try {
                            const res = await fetch(${JSON.stringify(url)}, {
                                ...${JSON.stringify(init || {})},
                                credentials: 'include',
                            });
                            const text = await res.text();
                            return { ok: true, bodyText: text, error: null };
                        } catch (e) {
                            return { ok: false, bodyText: '', error: String(e && e.message || e) };
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
                    const payload: TGateFectMainRes = {
                        ok: false,
                        reqId,
                        bodyText: "",
                        error: String(e?.message || e),
                    };
                    botWorker?.postMessage({ type: "bot:fetch:res", payload });
                }
            }
            if (msg?.type === "bot:order") {
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
            // if (msg?.type === "bot:order") {
            //     const { payloadOrder: payloadOrderRaw, selector, reqOrderId } = msg.payload;
            //     const tag = `O${reqOrderId}`;
            //     try {
            //         sendUiLog(`[${tag}] main:recv`);

            //         // 1) đợi request CORRECT **trước khi click**
            //         const waitOrder = waitForOneRequest(
            //             gateView.webContents,
            //             {
            //                 method: "POST",
            //                 urlPrefix: "https://www.gate.com/apiw/v2/futures/usdt/orders",
            //             },
            //             tag,
            //             10000,
            //         );

            //         // 2) chạy click JS
            //         sendUiLog(`[${tag}] click:start`);
            //         const js = createCodeStringClickOrder(selector);
            //         const clickRes: TResultClickOpenOrder = await gateView.webContents.executeJavaScript(js, true);
            //         sendUiLog(`[${tag}] click:done ${clickRes.ok ? "ok" : `err=${clickRes.error}`}`);

            //         if (clickRes.ok === false && clickRes.error) throw new Error(clickRes.error);

            //         // 3) chờ network kết thúc + lấy body
            //         const { bodyText } = await waitOrder;
            //         sendUiLog(`[${tag}] net:done bodyLen=${bodyText?.length ?? 0}`);

            //         botWorker?.postMessage({
            //             type: "bot:order:res",
            //             payload: { ok: true, reqOrderId, bodyText, error: null } as TGateOrderMainRes,
            //         });
            //     } catch (e: any) {
            //         sendUiLog(`[${tag}] FAIL ${String(e?.message || e)}`, "error");
            //         botWorker?.postMessage({
            //             type: "bot:order:res",
            //             payload: { ok: false, reqOrderId, bodyText: "", error: String(e?.message || e) } as TGateOrderMainRes,
            //         });
            //     }
            // }
            if (msg?.type === "bot:clickTabOpenOrder") {
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
            if (msg?.type === "bot:log") {
                mainWindow?.webContents.send("bot:log", msg.payload as { ts: number; level: "info" | "warn" | "error"; text: string });
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
        });
    }

    return botWorker!;
}

export function interceptRequest(gateView: WebContentsView) {
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
                        // case "POST https://www.gate.com/apiw/v2/futures/usdt/positions/BTC_USDT/leverage":
                        //     console.log(`[Fetch.requestPaused] ${key}`);

                        //     let bodyChangeLeverage = request.postData ?? "";
                        //     try {
                        //         const obj = JSON.parse(bodyChangeLeverage);

                        //         const modified = handlePayloadModification(obj, {
                        //             leverage: "20",
                        //         });

                        //         const jsonText = JSON.stringify(modified);

                        //         const postDataB64 = Buffer.from(jsonText, "utf8").toString("base64");

                        //         // Cập nhật headers (loại bỏ content-length để Chromium tự set lại)
                        //         // const headersArr = toHeaderArray(request.headers || {});
                        //         // deleteHeader(headersArr, "content-length");
                        //         // setHeader(headersArr, "content-type", "application/json; charset=utf-8");

                        //         await wc.debugger.sendCommand("Fetch.continueRequest", {
                        //             requestId,
                        //             postData: postDataB64,
                        //         });

                        //         if (networkId) watchNetworkIds.add(networkId);
                        //     } catch (err) {
                        //         console.log(`có lỗi`, err);
                        //         // Không phải JSON hoặc parse fail → cho qua
                        //         // await wc.debugger.sendCommand("Fetch.continueRequest", { requestId });
                        //     }
                        //     break;

                        case "POST https://www.gate.com/apiw/v2/futures/usdt/orders":
                            console.log(`[Fetch.requestPaused] ${key}`);

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

                                // Cập nhật headers (loại bỏ content-length để Chromium tự set lại)
                                // const headersArr = toHeaderArray(request.headers || {});
                                // deleteHeader(headersArr, "content-length");
                                // setHeader(headersArr, "content-type", "application/json; charset=utf-8");

                                await wc.debugger.sendCommand("Fetch.continueRequest", {
                                    requestId,
                                    postData: postDataB64,
                                });

                                if (networkId) watchNetworkIds.add(networkId);
                            } catch (err) {
                                console.log(`có lỗi`, err);
                                // Không phải JSON hoặc parse fail → cho qua
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
                        case "GET https://www.gate.com/apiw/v2/futures/usdt/accounts":
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
                    // const reqId = params.requestId as string;
                    // const rec = tracked.get(reqId);
                    // if (!rec) break;
                    // // Lấy body (đã giải nén). Có thể lớn → DevTools trả base64 khi cần.
                    // const { body, base64Encoded } = await wc.debugger.sendCommand("Network.getResponseBody", { requestId: reqId });
                    // const bodyText = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : (body as string);
                    // console.log({ method: rec.method, url: rec.url, status: rec.status, bodyText });
                    // // Dọn state để không rò rỉ
                    // tracked.delete(reqId);
                    // break;
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

type WaitOrderOpts = {
    method: "GET" | "POST" | "PUT" | "DELETE" | string;
    url: string; // match endpoint
    matchPost?: (postDataText: string) => boolean; // match body (nếu cần)
};

async function waitForOneRequest1(
    wc: Electron.WebContents,
    { method, url, matchPost }: WaitOrderOpts,
): Promise<{ requestId: string; status?: number; bodyText: string }> {
    return new Promise((resolve, reject) => {
        const tracked = new Set<string>();

        const onMsg = async (_e: any, ev: string, p: any) => {
            try {
                switch (ev) {
                    case "Network.requestWillBeSent": {
                        const m = p.request?.method as string;
                        const u = p.request?.url as string;
                        // if (m === method && url.test(u)) {
                        if (m === method && url === u) {
                            // nếu cần lọc theo body
                            if (matchPost) {
                                let post = p.request?.postData as string | undefined;
                                if (post == null) {
                                    // fallback lấy postData nếu không có trong event
                                    try {
                                        const r = await wc.debugger.sendCommand("Network.getRequestPostData", { requestId: p.requestId });
                                        post = r.postData as string;
                                    } catch {
                                        /* ignore */
                                    }
                                }
                                if (!post || !matchPost(post)) return;
                            }
                            tracked.add(p.requestId);
                        }
                        break;
                    }

                    case "Network.responseReceived": {
                        // có thể lưu status nếu cần (ở đây lấy trực tiếp khi finished cũng được)
                        break;
                    }

                    case "Network.loadingFinished": {
                        const reqId = p.requestId as string;
                        if (!tracked.has(reqId)) break;

                        const { body, base64Encoded } = await wc.debugger.sendCommand("Network.getResponseBody", { requestId: reqId });
                        const bodyText = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : (body as string);

                        // lấy status qua responseReceived? Hoặc bỏ qua nếu body đã đủ xác nhận
                        // Ở đây ta thử thêm 1 call để lấy status (optional)
                        let status: number | undefined;
                        try {
                            // không có API lấy status trực tiếp theo id, nên thường lưu ở responseReceived.
                            // Nếu bạn cần status, hãy lưu ở responseReceived vào 1 Map<id,status>.
                        } catch {}

                        cleanup(undefined, { requestId: reqId, status, bodyText });
                        break;
                    }

                    case "Network.loadingFailed": {
                        if (tracked.has(p.requestId as string)) {
                            cleanup(new Error("order network failed"));
                        }
                        break;
                    }
                }
            } catch (e) {
                cleanup(e as Error);
            }
        };

        const cleanup = (err?: Error, res?: any) => {
            wc.debugger.off("message", onMsg);
            tracked.clear();
            err ? reject(err) : resolve(res);
        };

        wc.debugger.on("message", onMsg);
    });
}

function sendUiLog(text: string, level: "info" | "warn" | "error" = "info") {
    // for (const win of BrowserWindow.getAllWindows()) {
    //     win.webContents.send("bot:log", { ts: Date.now(), level, text });
    // }
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
            const dt = Date.now() - t0;
            sendUiLog(`[${tag}] net:${ok ? "ok" : "err"} ${msg} • dt=${dt}ms ${extra ? `• ${JSON.stringify(extra)}` : ""}`, ok ? "info" : "error");
        };

        const onMsg = async (_e: any, method: string, params: any) => {
            try {
                if (method === "Network.requestWillBeSent") {
                    const req = params.request;
                    if (!req) return;
                    if (req.method === match.method && String(req.url).startsWith(match.urlPrefix)) {
                        tracked.add(params.requestId);
                        sendUiLog(`[${tag}] net:match ${req.method} ${req.url}`);
                    }
                } else if (method === "Network.responseReceived") {
                    const id = params.requestId;
                    if (tracked.has(id)) {
                        sendUiLog(`[${tag}] net:resp status=${params.response?.status ?? ""}`);
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
            finish(false, "waitForOneRequest timeout");
            clean();
            reject(new Error("waitForOneRequest timeout"));
        }, timeoutMs);
    });
}
