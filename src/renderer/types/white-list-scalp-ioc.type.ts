import { TBaseTimestamps } from "./base.type";

export type TWhiteListScalpIoc = {
    id: number;
    symbol: string;
    size: number;
    maxSize: number;
} & TBaseTimestamps;

export type TCreateWhiteListScalpIocReq = {
    symbol: string;
};

export type TRemoveWhiteListScalpIocReq = {
    symbol: string;
};

export type TMaxScapsPosition = {
    symbol: string;
    at: number
}
