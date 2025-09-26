
// ===== Types =====
type RawOrder = {
    id: number;
    id_string?: string;
    contract: string;
    status: "open" | "finished" | string;
    size: number; // dương = buy, âm = sell
    left: number; // còn lại (có thể âm cùng dấu với size)
    price: string; // chuỗi giá
    tif: string; // 'poc' = Post Only
    is_reduce_only: boolean;
    create_time: number; // epoch seconds
    text_output?: string; // 'Web'...
    leverage?: string;
};

type Side = "BUY" | "SELL";
type Intent = "OPEN" | "CLOSE";
type Label = "OPEN_LONG" | "OPEN_SHORT" | "CLOSE_LONG" | "CLOSE_SHORT";

type OrderView = {
    id: string;
    left: number;
    contract: string;
    intent: Intent;
    side: Side;
    label: Label;
    size: number; // số âm/dương như gốc
    remaining: number; // tuyệt đối phần còn lại
    priceStr: string; // giữ nguyên chuỗi trả về
    tif: string;
    reduceOnly: boolean;
    source?: string;
    leverage?: string;
    createdAt: number; // epoch seconds
};

// ===== 2 Map toàn cục =====
export const openOrderMap = new Map<string, OrderView>(); // is_reduce_only = false
export const closeOrderMap = new Map<string, OrderView>(); // is_reduce_only = true

// ===== Helpers =====
const classify = (o: RawOrder): { side: Side; intent: Intent; label: Label } => {
    const side: Side = o.size > 0 ? "BUY" : "SELL";
    const intent: Intent = o.is_reduce_only ? "CLOSE" : "OPEN";
    let label: Label;
    if (intent === "OPEN") {
        label = o.size > 0 ? "OPEN_LONG" : "OPEN_SHORT";
    } else {
        label = o.size > 0 ? "CLOSE_SHORT" : "CLOSE_LONG";
    }
    return { side, intent, label };
};

const normalize = (o: RawOrder): OrderView => {
    const { side, intent, label } = classify(o);
    const key = o.id_string ?? String(o.id);
    const remainingAbs = Math.abs(Number(o.left ?? 0));
    return {
        id: key,
        left: remainingAbs,
        contract: o.contract,
        intent,
        side,
        label,
        size: Number(o.size),
        remaining: remainingAbs,
        priceStr: o.price,
        tif: o.tif,
        reduceOnly: o.is_reduce_only,
        source: o.text_output,
        leverage: o.leverage,
        createdAt: o.create_time,
    };
};

// ===== Đồng bộ 2 Map từ mảng order =====
export function syncOrderMaps(orders: RawOrder[] | null) {
    // Xoá & xây lại để phản ánh đúng trạng thái hiện tại
    openOrderMap.clear();
    closeOrderMap.clear();

    if(orders === null) return;

    for (const o of orders) {
        if (o.status !== "open") continue; // phòng khi API trả thêm trạng thái khác
        const n = normalize(o);
        const bucket = n.reduceOnly ? closeOrderMap : openOrderMap;
        bucket.set(n.id, n);
    }
}

function pendingCloseCoverage(contract: string, side: "long" | "short"): number {
    let sum = 0;
    for (const o of closeOrderMap.values()) {
        if (o.contract !== contract) continue;
        // close long: size âm (sell) ; close short: size dương (buy)
        if (side === "long" && o.size < 0) sum += Math.abs(o.left ?? o.size);
        if (side === "short" && o.size > 0) sum += Math.abs(o.left ?? o.size);
    }
    return sum;
}