export type TSocketRoi = Record<string, TSocketRoiItem>;

export type TSocketRoiItem = {
  lastPrice?: number;
  quanto_multiplier?: number;
};
