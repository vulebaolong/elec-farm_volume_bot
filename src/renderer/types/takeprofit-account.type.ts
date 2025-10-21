import { TBaseTimestamps } from "./base.type";

export type TTakeprofitAccount = {
    id: number;
    userId: number;
    uid: number;
    source: string;
    phase: number;
    oldTotal: string;
    newTotal: string;
    pnl: number;
    roi: number;
} & TBaseTimestamps;

export type TCreateTakeprofitAccountReq = {
    uid: number;
    source: string;
    oldTotal: string;
    newTotal: string;
};

export type TUpdateTakeprofitAccountReq = {
    id: number;
    data: {
        newTotal: string;
        uid: number;
        source: string;
    };
};
