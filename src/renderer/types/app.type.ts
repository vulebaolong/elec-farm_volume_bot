export type TRes<T> = {
    status: string;
    statusCode: number;
    message: string;
    data: T;
};

export type TPaginationRes<T> = {
    page: number;
    pageSize: number;
    totalPage: number;
    totalItem: number;
    items: T[];
};

export type TQuery = {
    pagination: {
        page?: number;
        pageSize: number;
        afterUUIDv7?: string;
    };
    filters: Record<string, any>;
    sort: {
        sortBy: string;
        isDesc: boolean;
    };
};
