import { TBaseTimestamps } from "./base.type";
import { EStatusFixStopLoss } from "./enum/fix-stoploss.enum";
import { TOrderOpen } from "./order.type";
import { TPosition } from "./position.type";

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

export type TDataFixStopLoss = {
    dataStopLossShouldFix: TDataStopLossShouldFix | null;
    dataOrderOpenFixStopLoss: TDataOrderOpenFixStopLoss | null;
    dataCloseTP: TDataCloseTP | null;
    startTimeSec: number | null;
    stepFixStopLoss: number;
    inputUSDTFix: number | null;
    leverageFix: number | null;
    listDataFixStopLoss: TDataStopLossShouldFix[];
};

type TDataStopLossShouldFix = {
    contract: TPosition["contract"];
    open_time: TPosition["open_time"];
};

type TDataOrderOpenFixStopLoss = {
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
