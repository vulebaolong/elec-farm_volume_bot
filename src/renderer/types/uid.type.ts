import { TBaseTimestamps } from "./base.type";
import { TScopeExchanges } from "./scope-exchanges.type";

export type TUid = {
    id: number;
    uid: number;
    userId: number;
    exchangeId: number;
    isActive: boolean;
    ScopeExchanges: TScopeExchanges;
} & TBaseTimestamps;
