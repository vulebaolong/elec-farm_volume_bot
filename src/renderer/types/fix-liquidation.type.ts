import { TBaseTimestamps } from "./base.type";
import { THistoryAggregate } from "./bot.type";
import { EStatusFixLiquidation } from "./enum/fix-liquidation.enum";
import { TOrderOpen } from "./order.type";

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

export type TDataFixLiquidation = {
    dataLiquidationShouldFix: TDataLiquidationShouldFix | null;
    dataOrderOpenFixLiquidation: TDataOrderOpenFixLiquidation | null;
    dataCloseTP: TDataCloseTP | null;
    startTimeSec: number | null;
    stepFixLiquidation: number;
    inputUSDTFix: number | null;
    leverageFix: number | null;
};

type TDataLiquidationShouldFix = {
    contract: THistoryAggregate["contract"];
    create_time: THistoryAggregate["create_time"];
};

type TDataOrderOpenFixLiquidation = {
    contract: TOrderOpen["contract"];
    price: TOrderOpen["price"];
    fill_price: TOrderOpen["fill_price"];
    create_time: TOrderOpen["create_time"];
};

type TDataCloseTP = {
    contract: TOrderOpen["contract"];
    id_string: TOrderOpen["id_string"];
    price: TOrderOpen["price"];
    fill_price: TOrderOpen["fill_price"];
    create_time: TOrderOpen["create_time"];
};
