import { TSide } from "./base.type";
import { TAskFuturesOrderBook, TBidFuturesOrderBook } from "./order-book.type";

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
        spreadPercent?: number;
        imbalanceBidPercent?: number;
        imbalanceAskPercent?: number;
        lastPrice?: number;
        infoOBI: {
            OBI: number;
            tota5lBid: number;
            total5Ask: number;
        };
        infoAgg: {
            AGG: number;
            agg: number | null;
            sampleCount: number;
            sumAsk: number;
            sumBid: number;
        };
        infoTMM: {
            TMM: number;
            tickMoment: number;
            count: number;
            mid: number | null;
            sum: number;
        };
        sScalp?: number;
        sFarm?: number;
        sScalpString: string;
        sFarmString: string;
        bids: TBidFuturesOrderBook[];
        asks: TAskFuturesOrderBook[];
    };
    binance: {
        symbol: string;
        lastPrice?: number;
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

export type TWhitelistEntryNew = {
    symbol: string;
    side: TSide;
    order_price_round: number;
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
