import { TSide } from "@/types/base.type";
import { TPosition } from "@/types/position.type";
import { toSymbolKey } from "./function.helper";

export type Task_QueueOrder = {
    symbol: string;
    side: TSide;
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

export const analyzePositions = (positions: TPosition[]) => {
    // console.log({ positions, symbolsState, takeProfit });
    // 1) Lọc position đang mở (size != 0)
    const openPositionsList = positions.filter((pos) => Number(pos.size) !== 0);

    // Nếu không có position mở: clear hết queue và thoát
    if (openPositionsList.length === 0) {
        if (taskQueueOrder.size > 0) {
            taskQueueOrder.clear();
        }
        return;
    }

    // 2) Tạo set các symbol từ positions mở (để dùng xoá task thừa)
    const openSymbols = new Set<string>();

    // 3) Update/Create task tương ứng cho từng position đang mở
    for (const pos of openPositionsList) {
        const symbol = toSymbolKey(pos);
        openSymbols.add(symbol);

        const taskExisted = taskQueueOrder.get(symbol);
        if (taskExisted) {
            // Update in-place: rẻ hơn tạo mới
            taskExisted.resultPosition = pos;
        } else {
            // Khi mới mở app mà có lệnh treo từ trước -> tạo queue đồng bộ
            addTaskTo_QueueOrder(symbol, {
                createdAt: Date.now(),
                symbol,
                side: pos.mode === "dual_long" ? "long" : "short",
                size: pos.size.toString(),
                delay: 0,
                resultPosition: pos,
                handle: async () => {},
            });
        }
    }

    // 4) Xoá task nào KHÔNG còn trong danh sách position mở
    //    (tránh memory leak, giữ queue “sạch”)
    for (const key of taskQueueOrder.keys()) {
        if (!openSymbols.has(key)) {
            taskQueueOrder.delete(key);
        }
    }

    return openPositionsList;
};
