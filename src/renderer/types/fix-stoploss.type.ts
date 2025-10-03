import { TBaseTimestamps } from "./base.type";
import { EStatusFixStopLoss } from "./enum/fix-stoploss.enum";
import { TDataFixStopLoss } from "./martingale.type";

export type TUpsertFixStopLossReq = {
    scopeExchangeId: number;
    data: TDataFixStopLoss;
    startTimeSec: number;
    isDone: boolean;
    status: EStatusFixStopLoss;
};

export type TFixStopLossInDB = {
    id: number;
    userId: number;
    scopeExchangeId: number;
    data: TDataFixStopLoss;
    startTimeSec: number;
    isDone: boolean;
    status: EStatusFixStopLoss;
} & TBaseTimestamps;
