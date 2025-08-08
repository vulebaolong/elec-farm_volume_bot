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
  isLong: boolean;
  isShort: boolean;
  isDepth: boolean;
};
