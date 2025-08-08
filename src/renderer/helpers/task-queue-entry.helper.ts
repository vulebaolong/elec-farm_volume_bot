import { wait } from "./function.helper";

export const taskQueueEntry: (() => Promise<void>)[] = [];
let isProcessing = false;

export function addTaskTo_QueueEntry(task: () => Promise<void>) {
    if (taskQueueEntry.length > 0 || isProcessing) {
        console.log("⚠️ Queue đang bận, bỏ qua task mới.");
        return;
    }

    taskQueueEntry.push(task);
    process_QueueEntry();
}

async function process_QueueEntry() {
    if (isProcessing) return;

    isProcessing = true;

    while (taskQueueEntry.length > 0) {
        const currentTask = taskQueueEntry.shift();
        if (currentTask) {
            try {
                console.log("➡️ Xử lý Entry bắt đầu");
                await currentTask();
            } catch (err) {
                console.error("Lỗi xử lý task trong queue:", err);
            } finally {
                console.log("➡️ Xử lý Entry hoàn tất");
            }
        }
    }

    isProcessing = false;
}
