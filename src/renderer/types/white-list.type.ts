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
};

export type TWhitelistUi = {
    symbol: string;
    sizeStr: string | null;
    side: TSide | null;
    isSpread: boolean;
    isDepth: boolean;
    isSize: boolean;
    qualified: boolean;
    core: TCore;
    isLong: boolean;
    isShort: boolean;
};
