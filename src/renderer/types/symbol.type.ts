export type TSymbols = Record<string, SymbolState>;

export interface SymbolState {
    symbol: string;
    spreadPercent: number;
    imbalanceBidPercent: number;
    imbalanceAskPercent: number;
    bidUSD: number;
    askUSD: number;
    lastPrice: number;
    flags: TFlags;
}

export type TFlags = {
    isSpreadPercent: boolean;
    isDepth: boolean;
    entryBySettingUserId: Record<number, TEntrySpec>;
};

export type TEntrySpec = {
    settingUserId: number;
    isLong: boolean;
    isShort: boolean;
    size: string;
};
