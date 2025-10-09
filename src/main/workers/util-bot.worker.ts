import { ENDPOINT } from "@/constant/endpoint.constant";
import { TSide } from "@/types/base.type";
import { getSideRes } from "@/types/ccc.type";
import { EntrySignalMode } from "@/types/enum/entry-signal-mode.enum";
import { TSettingUsers } from "@/types/setting-user.type";
import { TCore, TWhiteListItem } from "@/types/white-list.type";
import axios from "axios";

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
    const { lastPrice } = whitelistItem.core.gate;
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

export function calcSize(inputUSDT: number, price: number, multiplier: number, minSize = 1, maxSize?: number, step = 1) {
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

const percentToFraction = (pct: number) => (Number.isFinite(pct) && pct >= 0 ? pct / 100 : 0);

export function handleGapForLong(lastPriceGate: number, lastPriceBinance: number, lastPriceGapGateAndBinancePercent: number): boolean {
    if (!(lastPriceGate > 0) || !(lastPriceBinance > 0)) return false;
    const gap = percentToFraction(lastPriceGapGateAndBinancePercent);
    return lastPriceGate * (1 + gap) <= lastPriceBinance;
}

export function handleGapForShort(lastPriceGate: number, lastPriceBinance: number, lastPriceGapGateAndBinancePercent: number): boolean {
    if (!(lastPriceGate > 0) || !(lastPriceBinance > 0)) return false;
    const gap = percentToFraction(lastPriceGapGateAndBinancePercent);
    return lastPriceGate * (1 - gap) >= lastPriceBinance;
}

// (tuỳ chọn) tiện debug: % chênh Binance vs Gate (dựa trên Gate)
export function gapPercentBinanceVsGate(lastPriceGate: number, lastPriceBinance: number): number {
    if (!(lastPriceGate > 0) || !(lastPriceBinance > 0)) return 0;
    return ((lastPriceBinance - lastPriceGate) / lastPriceGate) * 100;
}

export function handleImBalanceBidForLong(imbalanceBidPercent: number, ifImbalanceBidPercent: number): boolean {
    return imbalanceBidPercent > ifImbalanceBidPercent;
}

export function handleImBalanceAskForShort(imbalanceAskPercent: number, ifImbalanceAskPercent: number): boolean {
    return imbalanceAskPercent > ifImbalanceAskPercent;
}

async function getSideCCC(): Promise<getSideRes["side"] | null> {
    try {
        const { data } = await axios.get<getSideRes>(ENDPOINT.CCC.GET_SIDE);
        console.log("getSideCCC: ", data);
        return data.side;
    } catch (error) {
        console.log("getSideCCC: ", error);
        // this.logWorker.error(`getSideCCC: ${error}`);
        return null;
    }
}

type SignalInputs = {
    gapLong: boolean;
    gapShort: boolean;
    imbLong: boolean;
    imbShort: boolean;
};

// Các hàm đánh giá cho từng mode
function evalGap(side: TSide, signalInputs: SignalInputs): boolean {
    if (side === "long") {
        return signalInputs.gapLong;
    }
    return signalInputs.gapShort;
}

function evalImbalance(side: TSide, signalInputs: SignalInputs): boolean {
    if (side === "long") {
        return signalInputs.imbLong;
    }
    return signalInputs.imbShort;
}

function evalBoth(side: TSide, signalInputs: SignalInputs): boolean {
    if (side === "long") {
        return signalInputs.gapLong && signalInputs.imbLong;
    }
    return signalInputs.gapShort && signalInputs.imbShort;
}

function evalSignal(mode: EntrySignalMode | undefined, side: TSide, signalInputs: SignalInputs): boolean {
    switch (mode) {
        case EntrySignalMode.GAP:
            return evalGap(side, signalInputs);
        case EntrySignalMode.IMBALANCE:
            return evalImbalance(side, signalInputs);
        case EntrySignalMode.BOTH:
            return evalBoth(side, signalInputs);
        default:
            // Fallback an toàn nếu dữ liệu mode không hợp lệ → coi như BOTH
            return evalBoth(side, signalInputs);
    }
}

type THandleEntryCheckAll = {
    whitelistItem: TWhiteListItem;
    settingUser: TSettingUsers;
    sideCCC: getSideRes["side"] | null;
};
type THandleEntryCheckAllRes = {
    errString: string | null;
    qualified: boolean;
    result: {
        // cả 2 đều cần
        symbol: string;
        sizeStr: string;
        side: TSide | null;

        // cho bot worker
        askBest: number;
        bidBest: number;
        order_price_round: number;
        lastPriceGate: number;
        quanto_multiplier: number;

        // cho component whitelist
        core: TCore;
        isDepth: boolean;
        isLong: boolean;
        isShort: boolean;
        isSize: boolean;
        isSpread: boolean;
        gapPercentBiVsGate: number;
    } | null;
};
export function handleEntryCheckAll({ whitelistItem, settingUser, sideCCC }: THandleEntryCheckAll): THandleEntryCheckAllRes {
    const { core, contractInfo } = whitelistItem;
    const {
        askBest,
        askSumDepth,
        bidBest,
        bidSumDepth,
        imbalanceAskPercent,
        imbalanceBidPercent,
        lastPrice: lastPriceGate,
        spreadPercent,
        symbol,
    } = core.gate ?? {};

    const { lastPrice: lastPriceBinance } = core.binance ?? {};

    const { order_price_round } = contractInfo;

    const missing =
        !symbol ||
        spreadPercent == null ||
        bidSumDepth == null ||
        askSumDepth == null ||
        lastPriceGate == null ||
        lastPriceBinance == null ||
        imbalanceAskPercent == null ||
        imbalanceBidPercent == null ||
        order_price_round == null;

    if (missing) {
        const msg = `❌ ${symbol ?? "UNKNOWN"} core thiếu field: ${JSON.stringify(core)}`;
        return { errString: msg, qualified: false, result: null };
    }

    const isZero = lastPriceGate <= 0 || lastPriceBinance <= 0;
    if (isZero) {
        const msg = `❌ ${symbol} core có field giá trị 0: ${JSON.stringify(core)}`;
        return { errString: msg, qualified: false, result: null };
    }

    const isSpread = isSpreadPercent(spreadPercent, settingUser.minSpreadPercent, settingUser.maxSpreadPercent);
    const isDepth = isDepthCalc(askSumDepth, bidSumDepth, settingUser.maxDepth);

    const sizeStr = handleSize(whitelistItem, settingUser.inputUSDT);
    const isSize = checkSize(sizeStr);

    // 3) Kết hợp theo mode (mặc định BOTH = AND)
    const mode = settingUser.entrySignalMode;

    let isLong = false;
    let isShort = false;

    switch (mode) {
        case EntrySignalMode.GAP:
            isLong = handleGapForLong(lastPriceGate, lastPriceBinance, settingUser.lastPriceGapGateAndBinancePercent);
            isShort = handleGapForShort(lastPriceGate, lastPriceBinance, settingUser.lastPriceGapGateAndBinancePercent);
            break;
        case EntrySignalMode.IMBALANCE:
            isLong = handleImBalanceBidForLong(imbalanceBidPercent, settingUser.ifImbalanceBidPercent);
            isShort = handleImBalanceAskForShort(imbalanceAskPercent, settingUser.ifImbalanceAskPercent);
            break;
        case EntrySignalMode.BOTH:
            const isLongGap = handleGapForLong(lastPriceGate, lastPriceBinance, settingUser.lastPriceGapGateAndBinancePercent);
            const isLongImb = handleImBalanceBidForLong(imbalanceBidPercent, settingUser.ifImbalanceBidPercent);
            isLong = isLongGap && isLongImb;
            const isShortGap = handleGapForShort(lastPriceGate, lastPriceBinance, settingUser.lastPriceGapGateAndBinancePercent);
            const isShortImb = handleImBalanceAskForShort(imbalanceAskPercent, settingUser.ifImbalanceAskPercent);
            isShort = isShortGap && isShortImb;
            break;
        case EntrySignalMode.SIDE_CCC:
            isLong = sideCCC === "LONG";
            isShort = sideCCC === "SHORT";
            break;
    }

    const side = isLong ? "long" : isShort ? "short" : null;

    const qualified = isSpread && isDepth && isSize && !!side;

    return {
        errString: null,
        qualified,
        result: {
            // cả 2 đều cần
            symbol,
            sizeStr,
            side,

            // cho bot worker
            askBest,
            bidBest,
            order_price_round,
            lastPriceGate,
            quanto_multiplier: contractInfo.quanto_multiplier,

            // cho component whitelist
            core,
            isDepth,
            isLong,
            isShort,
            isSize,
            isSpread,
            gapPercentBiVsGate: gapPercentBinanceVsGate(lastPriceGate, lastPriceBinance),
        },
    };
}

type THandleEntryCheckAll2 = {
    whitelistItem: TWhiteListItem;
    settingUser: TSettingUsers;
};
type THandleEntryCheckAllRes2 = {
    errString: string | null;
    qualified: boolean;
    result: {
        // cả 2 đều cần
        symbol: string;
        sizeStr: string;
        side: TSide | null;

        // cho bot worker
        askBest: number;
        bidBest: number;
        order_price_round: number;
        lastPriceGate: number;
        quanto_multiplier: number;

        // cho component whitelist
        core: TCore;
        isDepth: boolean;
        isLong: boolean;
        isShort: boolean;
        isSize: boolean;
        isSpread: boolean;
        gapPercentBiVsGate: number;
    } | null;
};
export function handleEntryCheckAll2({ whitelistItem, settingUser }: THandleEntryCheckAll2): THandleEntryCheckAllRes2 {
    const { core, contractInfo } = whitelistItem;
    const {
        askBest,
        askSumDepth,
        bidBest,
        bidSumDepth,
        imbalanceAskPercent,
        imbalanceBidPercent,
        lastPrice: lastPriceGate,
        spreadPercent,
        symbol,
    } = core.gate ?? {};

    const { lastPrice: lastPriceBinance } = core.binance ?? {};

    const { order_price_round } = contractInfo;

    const missing =
        !symbol ||
        spreadPercent == null ||
        bidSumDepth == null ||
        askSumDepth == null ||
        lastPriceGate == null ||
        lastPriceBinance == null ||
        imbalanceAskPercent == null ||
        imbalanceBidPercent == null ||
        order_price_round == null;

    if (missing) {
        const msg = `❌ ${symbol ?? "UNKNOWN"} core thiếu field: ${JSON.stringify(core)}`;
        return { errString: msg, qualified: false, result: null };
    }

    const isZero = lastPriceGate <= 0 || lastPriceBinance <= 0;
    if (isZero) {
        const msg = `❌ ${symbol} core có field giá trị 0: ${JSON.stringify(core)}`;
        return { errString: msg, qualified: false, result: null };
    }

    const isSpread = isSpreadPercent(spreadPercent, settingUser.minSpreadPercent, settingUser.maxSpreadPercent);
    const isDepth = isDepthCalc(askSumDepth, bidSumDepth, settingUser.maxDepth);

    const sizeStr = handleSize(whitelistItem, settingUser.inputUSDT);
    const isSize = checkSize(sizeStr);

    // 3) Kết hợp theo mode (mặc định BOTH = AND)
    const mode = settingUser.entrySignalMode;

    let isLong = false;
    let isShort = false;

    switch (mode) {
        case EntrySignalMode.GAP:
            isLong = handleGapForLong(lastPriceGate, lastPriceBinance, settingUser.lastPriceGapGateAndBinancePercent);
            isShort = handleGapForShort(lastPriceGate, lastPriceBinance, settingUser.lastPriceGapGateAndBinancePercent);
            break;
        case EntrySignalMode.IMBALANCE:
            isLong = handleImBalanceBidForLong(imbalanceBidPercent, settingUser.ifImbalanceBidPercent);
            isShort = handleImBalanceAskForShort(imbalanceAskPercent, settingUser.ifImbalanceAskPercent);
            break;
        case EntrySignalMode.BOTH:
            const isLongGap = handleGapForLong(lastPriceGate, lastPriceBinance, settingUser.lastPriceGapGateAndBinancePercent);
            const isLongImb = handleImBalanceBidForLong(imbalanceBidPercent, settingUser.ifImbalanceBidPercent);
            isLong = isLongGap && isLongImb;
            const isShortGap = handleGapForShort(lastPriceGate, lastPriceBinance, settingUser.lastPriceGapGateAndBinancePercent);
            const isShortImb = handleImBalanceAskForShort(imbalanceAskPercent, settingUser.ifImbalanceAskPercent);
            isShort = isShortGap && isShortImb;
            break;
    }

    const side = isLong ? "long" : isShort ? "short" : null;

    const qualified = isSpread && isDepth && isSize && !!side;

    return {
        errString: null,
        qualified,
        result: {
            // cả 2 đều cần
            symbol,
            sizeStr,
            side,

            // cho bot worker
            askBest,
            bidBest,
            order_price_round,
            lastPriceGate,
            quanto_multiplier: contractInfo.quanto_multiplier,

            // cho component whitelist
            core,
            isDepth,
            isLong,
            isShort,
            isSize,
            isSpread,
            gapPercentBiVsGate: gapPercentBinanceVsGate(lastPriceGate, lastPriceBinance),
        },
    };
}
