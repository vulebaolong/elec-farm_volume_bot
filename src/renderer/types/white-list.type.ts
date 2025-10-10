import { TSide } from "./base.type";

export type TContractInfo = {
    symbol: string;
    quanto_multiplier: number;
    leverage_min: number;
    leverage_max: number;
    order_size_min: number;
    order_size_max: number;
    order_price_round: number;
};

export type TCore = {
    gate: {
        symbol: string;
        spreadPercent: number;
        imbalanceBidPercent: number;
        imbalanceAskPercent: number;
        bidSumDepth: number;
        askSumDepth: number;
        bidBest: number;
        askBest: number;
        lastPrice: number;
    };
     binance: {
        symbol: string;
        lastPrice: number;
    };
};

export type TWhiteListItem = {
    contractInfo: TContractInfo;
    core: TCore;
};

export type TWhiteList = Record<string, TWhiteListItem>;

export type TWhitelistEntry = {
    symbol: string;
    sizeStr: string;
    side: TSide;
    askBest: number;
    bidBest: number;
    order_price_round: number;
    lastPriceGate: number;
    quanto_multiplier: number;
};

export type TWhitelistEntryFarmIoc = {
    symbol: string;
    sizeStr: string;
    side: TSide | null;
    askBest: number;
    bidBest: number;
    order_price_round: number;
    lastPriceGate: number;
    quanto_multiplier: number;
};

export type TWhitelistUi = {
    core: TCore;
    symbol: string;
    side: TSide | null;
    isSpread: boolean;
    qualified: boolean;
    isLong: boolean;
    isShort: boolean;
    gapPercentBiVsGate: number;
};
