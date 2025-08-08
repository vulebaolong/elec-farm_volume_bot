import { TBaseTimestamps } from './base.type';

export type TSetting = {
  id: number;
  min24hQuoteVolume: number;
  maxAgvSpreadPercent: number;
  snapEveryMsSpread: number;
  totalMsSpread: number;
  minSpreadPercent: number;
  maxSpreadPercent: number;
  ifImbalanceBidPercent: number;
  ifImbalanceAskPercent: number;
  maxDepth: number;
  maxTotalOpenPO: number;
  maxPOPerToken: number;
} & TBaseTimestamps;

export type TSettingReq = {
  maxTotalOpenPO: number;
  // maxPOPerToken: number;
};
