import { TBaseTimestamps } from "./base.type";

export type TWhiteListFarmIoc = {
    id: number;
    symbol: string;
    size: number;
    maxSize: number;
} & TBaseTimestamps;

export type TCreateWhiteListFarmIocReq = {
    symbol: string;
};

export type TRemoveWhiteListFarmIocReq = {
    symbol: string;
};
