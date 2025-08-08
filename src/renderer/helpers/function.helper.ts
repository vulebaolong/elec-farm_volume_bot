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
    const openPositionsList = positions.filter((pos) => Number(pos.size) !== 0);

    const totalOpenPO = openPositionsList.length;

    const poPerToken: Record<string, number> = {};

    openPositionsList.forEach((pos) => {
        const symbol = pos.contract.replace("/", "_");

        poPerToken[symbol] = (poPerToken[symbol] || 0) + 1;

        const task = taskQueueOrder.get(symbol);
        if (task) {
            task.resultPosition = pos;
        } else {
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
    });

    return {
        totalOpenPO,
        poPerToken,
    };
};

export const wait = (miliseconds: number) => {
    return new Promise(function (resolve) {
        setTimeout(resolve, miliseconds);
    });
};
