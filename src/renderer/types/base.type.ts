export type TBaseTimestamps = {
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
};

export type TSocketRes<T> = {
    message: string;
    data: T;
};

export type TRespnoseGate<T> = {
    method: string;
    label: string;
    message: string;
    code: number;
    data: T;
};

export type TSide = 'long' | 'short';