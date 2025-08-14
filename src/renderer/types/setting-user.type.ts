import { TBaseTimestamps } from "./base.type";

export type TSettingUsers = {
    id: number;
    ifImbalanceBidPercent: number;
    ifImbalanceAskPercent: number;
    maxTotalOpenPO: number;
    maxSideLong: number;
    maxSideShort: number;
    leverage: number;
    inputUSDT: number;
    takeProfit: number;
    stopLoss: number;
    timeoutEnabled: boolean;
    timeoutMs: number;
} & TBaseTimestamps;

export type TSettingUsersSocket = Omit<TSettingUsers, keyof TBaseTimestamps>;
export type TSettingUsersUpdate = Partial<Omit<TSettingUsers, keyof TBaseTimestamps | "id">> & {
    id: number;
};
