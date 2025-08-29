// bot.worker.ts
import { parentPort, workerData } from "node:worker_threads";

const TICK_MS: number = Number(workerData?.tickMs ?? 1000);
let running = true;

// nhận lệnh từ thread cha
parentPort?.on("message", (msg) => {
    if (!msg) return;
    if (msg.type === "stop") {
        running = false;
        clearInterval(timer);
        parentPort?.postMessage({ type: "stopped" });
        // optional: process.exit(0);
    }
    if (msg.type === "set-tick") {
        // thay đổi chu kỳ khi đang chạy
        const next = Number(msg.ms);
        if (Number.isFinite(next) && next > 0) {
            clearInterval(timer);
            (globalThis as any).timer = setInterval(tick, next);
            parentPort?.postMessage({ type: "tick-updated", ms: next });
        }
    }
});

function tick() {
    if (!running) return;
    // TODO: đặt logic của bạn ở đây (vòng lặp chính)
    parentPort?.postMessage({ type: "heartbeat", ts: Date.now() });
}

const timer = setInterval(tick, TICK_MS);
