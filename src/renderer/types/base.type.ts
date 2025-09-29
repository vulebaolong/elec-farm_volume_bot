export type TBaseTimestamps = {
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
};

export type TSocketRes<T> = {
    code: number;
    message: string;
    data: T;
    error: any | null;
};

export type TRespnoseGate<T> = {
    method: string;
    label: string;
    message: string;
    code: number;
    data: T;
};

export type TSide = "long" | "short";

export type TFindAll = {
    pagination: {
        pageIndex: number;
        pageSize: number;
    };
    filters: {
        [key: string]: any;
    };
    sort: {
        sortBy: string;
        isDesc: boolean;
    };
};
