import { TBaseTimestamps } from "./base.type";
import { EStatusFixLiquidation } from "./enum/fix-liquidation.enum";
import { TDataFixLiquidation } from "./martingale.type";

export type TUpsertFixLiquidationReq = {
    scopeExchangeId: number;
    data: TDataFixLiquidation;
    startTimeSec: number;
    isDone: boolean;
    status: EStatusFixLiquidation;
};

export type TFixLiquidationInDB = {
    id: number;
    userId: number;
    scopeExchangeId: number;
    data: TDataFixLiquidation;
    startTimeSec: number;
    isDone: boolean;
    status: EStatusFixLiquidation;
} & TBaseTimestamps;
