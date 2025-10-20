import { ROLE_ADMIN_ALLOWED } from "@/constant/app.constant";
import { TSide } from "@/types/base.type";
import { TPosition } from "@/types/position.type";
import { TRole } from "@/types/role.type";
import dayjs from "dayjs";

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

export const formatLocalTime = (time?: dayjs.ConfigType, format = "HH:mm:ss DD/MM/YYYY") => {
    if (typeof time === "string") {
        if (format === `ago`) return dayjs(time).fromNow();
        return dayjs.utc(time).local().format(format);
    } else if (typeof time === "number") {
        if (format === `ago`) return dayjs.unix(time).local().fromNow();
        return dayjs.unix(time).local().format(format);
    } else {
        if (format === `ago`) return dayjs().local().fromNow();
        return dayjs().local().format(format);
    }
};

function truncateToDp(value: number, dp = 2): number {
    const factor = 10 ** dp;
    return Math.trunc(value * factor) / factor; // cắt bớt, không làm tròn
}

export function accountEquity(total: string, unrealised_pnl: string): string {
    const equity = Number(total) + Number(unrealised_pnl);
    const truncated = truncateToDp(equity, 2);
    // Nếu muốn tránh -0.00 thì bỏ đoạn dưới; nếu muốn giữ giống UI có thể giữ -0.00
    const cleaned = Object.is(truncated, -0) ? 0 : truncated;
    return cleaned.toFixed(2);
}

export function roleAllowed(roleId: TRole["id"] | undefined): boolean {
    if (roleId === undefined) return false;
    if (ROLE_ADMIN_ALLOWED.includes(roleId)) {
        return true;
    } else {
        return false;
    }
}

export function handleSideNew(s: number, tauS?: number): TSide | null {
    if (tauS === undefined || tauS === null) return null;

    if (s > tauS) {
        return "long";
    } else if (s < -tauS) {
        return "short";
    } else {
        return null;
    }
}
