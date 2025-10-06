import { TBaseTimestamps } from "./base.type";
import { TDataStopLossShouldFix } from "./fix-stoploss.type";
import { TUser } from "./user.type";

export type TUpsertFixStopLossQueueReq = {
    queue: TDataStopLossShouldFix[];
};

export type TFixStopLossQueueInDB = {
    id: number;
    queue: TDataStopLossShouldFix[];
    userId: TUser["id"];
} & TBaseTimestamps;
