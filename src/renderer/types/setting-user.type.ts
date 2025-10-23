import { TBaseTimestamps } from "./base.type";

export type TSettingUsers = {
    id: number;
    maxTotalOpenPO: number;
    leverage: number;
    stopLossUsdtPnl: number;
    indexBidAsk: number;
    delayFarm: number;
    delayScalp: number;
    tauS: number;
    logType: number;
    stepS: number;
    tauSWindow: TTimeFrame[] | null;
} & TBaseTimestamps;

export type TTimeFrame = {
    start: string;
    end: string;
    tauS: number;
};

export type TSettingUsersSocket = Omit<TSettingUsers, keyof TBaseTimestamps>;
export type TSettingUsersUpdate = Partial<Omit<TSettingUsers, keyof TBaseTimestamps | "id">> & {
    id: number;
};
