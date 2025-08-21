import { TSide } from "@/types/base.type";
import { TPosition } from "@/types/position.type";

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

export const wait = (miliseconds: number) => {
    return new Promise(function (resolve) {
        setTimeout(resolve, miliseconds);
    });
};

export function isDefined<T>(value: T): value is NonNullable<T> {
    return value !== undefined && value !== null;
}

export function checkSize(size: string | null | undefined): boolean {
    // Nếu size null/undefined hoặc bằng "0" hoặc không phải số => false
    if (size == null || size === "0" || isNaN(Number(size)) || Number(size) === 0) {
        return false;
    }
    return true; // Ngược lại thì hợp lệ
}

// tickInfo: lấy số chữ số thập phân & scale từ tick (hỗ trợ cả "1e-6")
export const getTickInfo = (tick: number) => {
    const s = String(tick);
    let dec = 0;
    if (s.includes("e-")) dec = Number(s.split("e-")[1]);
    else {
        const i = s.indexOf(".");
        dec = i >= 0 ? s.length - i - 1 : 0;
    }
    const scale = 10 ** dec;
    return { dec, scale };
};

// chuyển giá <-> tick (số nguyên)
export const toTicks = (price: number, scale: number) => Math.round(price * scale);
export const fromTicks = (ticks: number, scale: number, dec: number) => (ticks / scale).toFixed(dec); // trả về string chuẩn (không 1e-8)

export function computePostOnlyPrice(
    side: TSide,
    item: { askBest: number; bidBest: number; orderPriceRound: number },
    k = 5, // số tick muốn lệch
) {
    const { dec, scale } = getTickInfo(item.orderPriceRound);
    const askTicks = toTicks(item.askBest, scale);
    const bidTicks = toTicks(item.bidBest, scale);

    // vì tick * scale = 1 tick = 1 đơn vị
    let priceTicks = side === "long" ? askTicks - k : bidTicks + k;

    // đảm bảo điều kiện Post Only tại thời điểm tính
    if (side === "long" && priceTicks >= askTicks) priceTicks = askTicks - 1;
    if (side === "short" && priceTicks <= bidTicks) priceTicks = bidTicks + 1;

    return fromTicks(priceTicks, scale, dec); // string đã format đúng tick
}

export const toUnderscore = (s: string) => s.replace("/", "_");
export const toSymbolKey = (pos: TPosition) => toUnderscore(pos.contract);

function decimalsFromTick(tick: number) {
    const s = String(tick);
    if (s.includes("e-")) return Number(s.split("e-")[1]);
    const i = s.indexOf(".");
    return i >= 0 ? s.length - i - 1 : 0;
}

export function tpPrice(entry: number, tpPercent: number, side: "long" | "short", tick: number): string {
    const factor = side === "long" ? 1 + tpPercent : 1 - tpPercent;
    const raw = entry * factor;
    const dec = decimalsFromTick(tick);
    const rounded = Math.round(raw / tick) * tick;
    return rounded.toFixed(dec); // trả về chuỗi đúng tick
}

type Book = { bidBest: number; askBest: number; orderPriceRound: number };

const decimals = (tick: number) => (String(tick).includes("e-") ? Number(String(tick).split("e-")[1]) : (String(tick).split(".")[1]?.length ?? 0));

const fmt = (x: number, tick: number) => x.toFixed(decimals(tick));

/**
 * Tạo dãy giá Post-Only theo bậc tick, bắt đầu cách mép spread `startTicks`.
 * - long  : từ bid + startTicks*tick, rồi + stepTicks mỗi lớp, nhưng không vượt ask - 1*tick
 * - short : từ ask - startTicks*tick, rồi - stepTicks mỗi lớp, nhưng không thấp hơn bid + 1*tick
 *
 * clampEdge:
 *  - "clip": nếu vượt mép maker thì kẹp về mép (ask-1tick / bid+1tick)
 *  - "skip": bỏ qua lớp đó (spread quá hẹp)
 */
export function ladderPricesByTick(
    side: TSide,
    book: Book,
    layers: number,
    stepTicks = 1,
    startTicks = 1,
    clampEdge: "clip" | "skip" = "clip",
): string[] {
    const { bidBest, askBest, orderPriceRound: tick } = book;
    const makerCeilBuy = askBest - tick; // BUY tối đa để vẫn maker
    const makerFloorSell = bidBest + tick; // SELL tối thiểu để vẫn maker

    const prices: number[] = [];
    for (let i = 0; i < layers; i++) {
        const offset = startTicks + i * stepTicks;

        // đề xuất thô theo phía
        let raw = side === "long" ? bidBest + offset * tick : askBest - offset * tick;

        // đảm bảo Post-Only
        if (side === "long" && raw > makerCeilBuy) {
            if (clampEdge === "clip") raw = makerCeilBuy;
            else continue;
        }
        if (side === "short" && raw < makerFloorSell) {
            if (clampEdge === "clip") raw = makerFloorSell;
            else continue;
        }

        // tránh giá trùng khi spread quá hẹp
        if (prices.length && Math.abs(raw - prices[prices.length - 1]) < 1e-12) break;
        prices.push(raw);
    }

    return prices.map((p) => fmt(p, book.orderPriceRound));
}

/** Build payload open lệnh (Post-Only) theo dãy trên */
export function buildLadderOpenOrders(
    side: TSide,
    book: Book,
    layers: number,
    stepTicks = 1,
    startTicks = 1,
    clampEdge: "clip" | "skip" = "clip",
) {
    const prices = ladderPricesByTick(side, book, layers, stepTicks, startTicks, clampEdge);
    const signed = (n: number) => (side === "long" ? n : -n); // long=buy(+), short=sell(-)
    return prices.map((price) => ({
        price,
    }));
}
