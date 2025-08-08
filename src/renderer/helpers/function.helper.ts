import { TPosition } from "@/types/position.type";
import { addTaskTo_QueueOrder, taskQueueOrder } from "./task-queue-order.helper";

export const resError = (error: any, defaultMes: string) => {
    const mes = error?.response?.data?.message;

    if (Array.isArray(mes)) return mes[0];

    if (typeof mes === "string") return mes;

    if (error?.message) return error?.message;

    return defaultMes;
};
export const tryJSONparse = (string: string) => {
    try {
        return JSON.parse(string);
    } catch {
        console.log(`Không parser được dữ liệu`, string);
        return string;
    }
};

export const analyzePositions = (positions: TPosition[]) => {
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
        const symbol = pos.contract.replace("/", "_");
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

    // openPositionsList.forEach((pos) => {
    //     const symbol = pos.contract.replace("/", "_");

    //     const task = taskQueueOrder.get(symbol);
    //     if (task) {
    //         task.resultPosition = pos;
    //     } else {
    //         /**
    //          * - khi mới mở ứng dụng mà vẫn còn đang có lệnh treo
    //          * - thì tạo mới queue để đồng bộ
    //          */
    //         addTaskTo_QueueOrder(symbol, {
    //             createdAt: Date.now(),
    //             symbol,
    //             side: pos.mode === "dual_long" ? "long" : "short",
    //             size: pos.size.toString(),
    //             delay: 0,
    //             resultPosition: pos,
    //             handle: async () => {},
    //         });
    //     }
    // });
};

export const wait = (miliseconds: number) => {
    return new Promise(function (resolve) {
        setTimeout(resolve, miliseconds);
    });
};
