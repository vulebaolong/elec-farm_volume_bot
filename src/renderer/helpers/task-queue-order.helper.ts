import { TPosition } from "@/types/position.type";

export type Task_QueueOrder = {
    symbol: string;
    side: "long" | "short";
    size: string;
    delay: number;
    createdAt: number;
    resultPosition: TPosition | null;
    handle: (task: Task_QueueOrder) => Promise<void>;
    isHandled?: boolean;
};

export const taskQueueOrder = new Map<string, Task_QueueOrder>();
let isProcessing = false;

export const addTaskTo_QueueOrder = (key: string, task: Task_QueueOrder) => {
    if (taskQueueOrder.has(key)) {
        console.warn(`Đã có key trong taskQueueOrder, bỏ qua`);
        return;
    }
    taskQueueOrder.set(key, task);
    console.log(`Thêm task: ${key} - `, Array.from(taskQueueOrder.entries()));
    process_QueueOrder(); // bắt đầu xử lý nếu chưa chạy
};

export const cancelAndRemoveTask_QueueOrder = (key: string) => {
    const task = taskQueueOrder.get(key);
    if (!task) return;

    // Remove khỏi queue
    taskQueueOrder.delete(key);
    console.log(`Đã hủy và xóa task: ${key} - `, Array.from(taskQueueOrder.entries()));
};

export const process_QueueOrder = async () => {
    if (isProcessing) return;
    isProcessing = true;

    for (const [key, task] of taskQueueOrder) {
        if (task.isHandled) continue; // ✅ Bỏ qua task đã xử lý

        console.log(`⏳ Xử lý task: ${key}`);

        try {
            // 1. Thực thi task
            await task.handle(task);
            task.isHandled = true; // ✅ đánh dấu đã chạy

            // 2. Delay giữa các task
            console.log(`🕒 Delay ${task.delay}ms cho task ${key}`);
            await new Promise((res) => setTimeout(res, task.delay));
        } catch (err) {
            console.error(`❌ Lỗi xử lý task ${key}:`, err);
        }
    }

    isProcessing = false;
};
