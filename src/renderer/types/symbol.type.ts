export type TSymbols = Record<string, SymbolState>;

export interface SymbolState {
    symbol: string;
    spreadPercent: number;
    imbalanceBidPercent: number;
    imbalanceAskPercent: number;
    bidSumDepth: number;
    askSumDepth: number;
    bidBest: number;
    askBest: number;
    orderPriceRound: number;
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
