export type TWhiteListItem = {
  symbol: string;
  quanto_multiplier: number;
  leverage_max: number;
  leverage_min: number;
};

export type TWhiteList = Record<string, TWhiteListItem>;
