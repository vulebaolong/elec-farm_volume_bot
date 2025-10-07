import { TBaseTimestamps } from "./base.type";

export type TScopeExchanges = {
    id: number;
    exchange: string;
    deletedBy: number;
    isDeleted: boolean;
    deletedAt: any;
    createdAt: string;
    updatedAt: string;
} & TBaseTimestamps;
