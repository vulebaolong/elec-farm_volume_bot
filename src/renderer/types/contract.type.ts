import { symbol } from "zod";

export type TContract = {
    symbol: string;
    quanto_multiplier: number;
    leverage_min: number;
    leverage_max: number;
    order_size_min: number;
    order_size_max: number;
    order_price_round: number;
};

export type TGetInfoContractRes = {
    contract: string;
    quanto_multiplier: number;
    leverage_min: number;
    leverage_max: number;
    order_size_min: number;
    order_size_max: number;
    order_price_round: number;
};

export type TContractSymbolRes = {
    id: number;
    symbol: string;
};
