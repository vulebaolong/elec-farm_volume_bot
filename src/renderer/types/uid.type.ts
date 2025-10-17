import { TBaseTimestamps } from "./base.type";
import { TScopeExchanges } from "./scope-exchanges.type";
import { TUser } from "./user.type";

export type TUid = {
    id: number;
    uid: number;
    userId: number;
    exchangeId: number;
    isActive: boolean;
    ScopeExchanges: TScopeExchanges;
} & TBaseTimestamps;

export type TUidCreate = {
    userId: TUser["id"];
    uid: TUid["uid"];
};

export type TUidUpdate = Partial<TUidCreate> & {
    id: TUid["id"];
}

export type TUidDelete = {
    id: TUid["id"];
};
