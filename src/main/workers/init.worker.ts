// src/main/workers/init.worker.ts
import { app, BrowserWindow, ipcMain, WebContentsView } from "electron";
import path from "node:path";
import { Worker } from "node:worker_threads";

let botWorker: Worker | null = null;

export function initBot(mainWindow: BrowserWindow | null, gateView: WebContentsView) {
    if (!botWorker) {
        const workerPath = app.isPackaged
            ? path.join(process.resourcesPath, "app.asar.unpacked", "dist", "main", "workers", "bot.worker.js")
            : path.join(__dirname, "workers", "bot.worker.bundle.dev.js");

        botWorker = new Worker(workerPath, {
            workerData: { tickMs: 1000 }, // nếu cần tham số khởi tạo 1 lần
        });

        botWorker.on("error", (err) => console.error("botWorker error:", err));
        botWorker.on("exit", (code) => {
            console.log("botWorker exit:", code);
            botWorker = null;
        });

        // ⬇️ Chờ thread vào trạng thái online rồi mới gửi init
        botWorker.once("online", () => {});

        // lắng nghe từ rerender
        ipcMain.on("bot:start", (event, data) => {
            botWorker?.postMessage({ type: "bot:start" });
        });
        ipcMain.on("bot:stop", (event, data) => {
            botWorker?.postMessage({ type: "bot:stop" });
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
                const {  url, init, reqId } = msg.payload;
                const res = await gateFetch(gateView,{ url, init });
                try {
                    const payload = { reqId, res, error: null };
                    botWorker?.postMessage({ type: "bot:fetch:res", payload });
                } catch (e: any) {
                    const payload = { reqId, res, error:  String(e?.message || e) };
                    botWorker?.postMessage({ type: "bot:fetch:res", payload });
                }
            }
        });
    }

    return botWorker!;
}

export async function gateFetch(gateView: WebContentsView,req: { url: string; init?: any }) {
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
