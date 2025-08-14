import { TBaseTimestamps } from "./base.type";

export type TSettingSystem = {
    id: number;
    min24hQuoteVolume: number;
    maxAgvSpreadPercent: number;
    snapEveryMsSpread: number;
    totalMsSpread: number;
    minSpreadPercent: number;
    maxSpreadPercent: number;
    maxDepth: number;
} & TBaseTimestamps;

export type TSettingSystemsSocket = Omit<TSettingSystem, keyof TBaseTimestamps>;
export type TSettingSystemsUpdate = Partial<Omit<TSettingSystem, keyof TBaseTimestamps>>;

