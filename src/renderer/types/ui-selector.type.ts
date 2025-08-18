import { TBaseTimestamps } from "./base.type";

export type TUiSelector = {
    id: number;
    scopeExchangeId: number;
    code: string;
    selectorValue: string;
    description: string;
} & TBaseTimestamps;
