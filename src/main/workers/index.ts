// workers/index.ts
import path from "node:path";
import { Worker } from "node:worker_threads";

let botWorker: Worker | null = null;

export function startBotWorker() {
    if (botWorker) return botWorker;

    // đường dẫn đến file JS đã biên dịch của worker
    // (nếu bạn dùng TS, file này sẽ thành bot.worker.js cạnh file main đã build)
    const workerPath = path.join(__dirname, "workers", "bot.worker.js");

    botWorker = new Worker(workerPath, {
        workerData: { tickMs: 1000 }, // vòng lặp mỗi 1s
    });

    botWorker.on("message", (msg) => {
        // nhận heartbeat/log… từ worker
        if (msg?.type === "heartbeat") {
            // console.log("[BOT]", new Date(msg.ts).toISOString());
        }
    });

    botWorker.on("error", (err) => {
        console.error("botWorker error:", err);
    });

    botWorker.on("exit", (code) => {
        console.log("botWorker exit:", code);
        botWorker = null;
    });

    return botWorker;
}

export async function stopBotWorker() {
    if (!botWorker) return;
    try {
        // báo dừng “mềm”
        botWorker.postMessage({ type: "stop" });
        // đợi 300ms rồi terminate nếu cần
        await new Promise((r) => setTimeout(r, 300));
        await botWorker.terminate();
    } catch (e) {
        console.error("stopBotWorker error:", e);
    } finally {
        botWorker = null;
    }
}

export function setBotTick(ms: number) {
    if (botWorker) botWorker.postMessage({ type: "set-tick", ms });
}
