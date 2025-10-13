import { TBaseTimestamps } from "./base.type";

export type TWhiteListIoc = {
    id: number;
    symbol: string;
    size: number;
    maxSize: number;
} & TBaseTimestamps;

export type TCreateWhiteListIocReq = {
    symbol: string;
};

export type TRemoveWhiteListIocReq = {
    symbol: string;
};
