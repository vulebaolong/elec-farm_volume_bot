// src/main/workers/init.worker.ts
import { LogLine } from "@/components/terminal-log/terminal-log";
import { createCodeStringClickOrder } from "@/javascript-string/logic-farm";
import { TPayloadOrder } from "@/types/bot.type";
import { TWorkerData } from "@/types/worker.type";
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

        botWorker = new Worker(workerPath, {
            workerData: { tickMs: 1000 }, // nếu cần tham số khởi tạo 1 lần
        });

        interceptRequest(gateView);

        botWorker.on("error", (err) => {
            console.error("botWorker error:", err);
            const payload: LogLine = { ts: Date.now(), level: "error", text: err?.message };
            mainWindow?.webContents.send("bot:log", payload);
        });
        botWorker.on("exit", (code) => {
            console.log("botWorker exit:", code);
            const payload: LogLine = { ts: Date.now(), level: "error", text: `${code}` };
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
                const res = await gateFetch(gateView, { url, init });
                try {
                    const payload = { reqId, res, error: null };
                    botWorker?.postMessage({ type: "bot:fetch:res", payload });
                } catch (e: any) {
                    const payload = { reqId, res, error: String(e?.message || e) };
                    botWorker?.postMessage({ type: "bot:fetch:res", payload });
                }
            }
            if (msg?.type === "bot:order") {
                const { payloadOrder: payloadOrderRaw, selector } = msg?.payload;

                payloadOrder = payloadOrderRaw;

                // Tạo promise chờ API order
                const waitOrder = waitForOneRequest(gateView.webContents, {
                    method: "POST",
                    url: "https://www.gate.com/apiw/v2/futures/usdt/orders",
                    timeoutMs: 15000,
                });

                // Thực hiện click (trả về khi JS của bạn xong, không phải khi API xong)
                const js = createCodeStringClickOrder(selector);
                await gateView.webContents.executeJavaScript(js, true);

                // Chờ API xong, lấy body
                try {
                    const { bodyText } = await waitOrder;
                    botWorker?.postMessage({ type: "bot:order:res", payload: { ok: true, bodyText, error: null } });
                } catch (e) {
                    botWorker?.postMessage({ type: "bot:order:res", payload: { ok: false, bodyText: "", error: String(e) } });
                }
            }
            if (msg?.type === "bot:clickTabOpenOrder") {
                try {
                    const result: boolean = await gateView.webContents.executeJavaScript(msg?.payload, true);
                    botWorker?.postMessage({ type: "bot:clickTabOpenOrder:res", payload: { ok: true, result, error: null } });
                } catch (e) {
                    botWorker?.postMessage({ type: "bot:clickTabOpenOrder:res", payload: { ok: false, result: null, error: String(e) } });
                }
            }
            if (msg?.type === "bot:clickCanelAllOpen") {
                try {
                    const result = await gateView.webContents.executeJavaScript(msg?.payload, true);
                    botWorker?.postMessage({ type: "bot:clickCanelAllOpen:res", payload: { ok: true, result, error: null } });
                } catch (e) {
                    botWorker?.postMessage({ type: "bot:clickCanelAllOpen:res", payload: { ok: false, result: null, error: String(e) } });
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

export async function gateFetch(gateView: WebContentsView, req: { url: string; init?: any }) {
    if (!gateView) throw new Error("gateView not ready");
    const { url, init } = req;

    // Lưu ý: luôn JSON.stringify để tránh chèn mã
    const js = `
    (async () => {
      const res = await fetch(${JSON.stringify(url)}, {
        ...${JSON.stringify(init || {})},
        credentials: 'include' // đảm bảo gửi cookie với cross-site nếu cần
      });
      const text = await res.text(); // hoặc .json() nếu chắc chắn JSON
      return { ok: res.ok, status: res.status, body: text };
    })()
  `;
    return gateView.webContents.executeJavaScript(js, true);
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
                        case "POST https://www.gate.com/apiw/v2/futures/usdt/positions/BTC_USDT/leverage":
                            console.log(`[Fetch.requestPaused] ${key}`);

                            let bodyChangeLeverage = request.postData ?? "";
                            try {
                                const obj = JSON.parse(bodyChangeLeverage);

                                const modified = handlePayloadModification(obj, {
                                    leverage: "20",
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
                        // case /^POST /.test(key) && /\/positions\/[^/]+\/leverage$/.test(url):
                        //   tracked.set(reqId, { method: m, url });
                        //   break;
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
    timeoutMs?: number;
};

async function waitForOneRequest(
    wc: Electron.WebContents,
    { method, url, matchPost, timeoutMs = 15000 }: WaitOrderOpts,
): Promise<{ requestId: string; status?: number; bodyText: string }> {
    return new Promise((resolve, reject) => {
        const tracked = new Set<string>();
        const timer = setTimeout(() => {
            cleanup(new Error("order timeout"));
        }, timeoutMs);

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
            clearTimeout(timer);
            wc.debugger.off("message", onMsg);
            tracked.clear();
            err ? reject(err) : resolve(res);
        };

        wc.debugger.on("message", onMsg);
    });
}
