import { TWhiteListItem } from "@/types/white-list.type";

/**
 * Spread từ 0.05% đến 0.20%
 */
export function isSpreadPercent(spreadPercent: number, minSpreadPercent: number, maxSpreadPercent: number): boolean {
    if (!spreadPercent) return false;
    const result = spreadPercent >= minSpreadPercent && spreadPercent <= maxSpreadPercent; // Spread 0.05% – 0.20%
    return result;
}

export function isDepthCalc(askSumDepth: number, bidSumDepth: number, maxDepth: number): boolean {
    return bidSumDepth >= maxDepth || askSumDepth >= maxDepth;
}

/**
 * hàm này sẽ được tính toán ở entry
 * quét SymbolState và tính size cho từng settingUser
 */
export function handleSize(whitelistItem: TWhiteListItem, inputUSDT: number): string {
    const { order_size_min, order_size_max, quanto_multiplier, symbol } = whitelistItem.contractInfo;
    const { lastPrice } = whitelistItem.core;
    if ([order_size_min, order_size_max, quanto_multiplier, inputUSDT, lastPrice].some((v) => v === null || v === undefined)) {
        console.log(`${symbol} - Tham số không hợp lệ: `, { order_size_min, order_size_max, quanto_multiplier, inputUSDT, lastPrice });
        return "0";
    }

    if (lastPrice === null || lastPrice === undefined || isNaN(lastPrice)) {
        console.log(`${symbol} - Giá không hợp lệ: `, lastPrice);
        return "0";
    } // Giá không hợp lệ

    const size = calcSize(inputUSDT, lastPrice, quanto_multiplier, order_size_min, order_size_max, order_size_min);

    if (size == null || isNaN(size)) {
        console.log(`${symbol} - Size không hợp lệ: `, size);
        return "0";
    }

    return size.toString();
}

function calcSize(inputUSDT: number, price: number, multiplier: number, minSize = 1, maxSize?: number, step = 1) {
    if (!(price > 0) || !(multiplier > 0)) return 0;
    let size = Math.floor(inputUSDT / price / multiplier / step) * step;
    // size = Math.max(size, minSize);
    if (size < minSize) return 0;
    if (maxSize != null) size = Math.min(size, maxSize);
    return size;
}

export function checkSize(size: string | null | undefined): boolean {
    if (typeof size !== "string") return false;
    const s = size.trim();
    return /^[1-9]\d*$/.test(s);
}
