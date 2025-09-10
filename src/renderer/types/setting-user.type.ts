import { TBaseTimestamps } from "./base.type";
import { EntrySignalMode } from "./enum/entry-signal-mode.enum";

export type TSettingUsers = {
    id: number;
    maxTotalOpenPO: number;
    maxSideLong: number;
    maxSideShort: number;
    leverage: number;
    inputUSDT: number;
    takeProfit: number;
    stopLoss: number;
    timeoutEnabled: boolean;
    timeoutMs: number;
    minSpreadPercent: number;
    maxSpreadPercent: number;
    maxDepth: number;
    timeoutClearOpenSecond: number;
    lastPriceGapGateAndBinancePercent: number;
    // max24hChangeGreen: number;
    // max24hChangeRed: number;
    ifImbalanceBidPercent: number;
    ifImbalanceAskPercent: number;
    entrySignalMode: EntrySignalMode;
} & TBaseTimestamps;

export type TSettingUsersSocket = Omit<TSettingUsers, keyof TBaseTimestamps>;
export type TSettingUsersUpdate = Partial<Omit<TSettingUsers, keyof TBaseTimestamps | "id">> & {
    id: number;
};
