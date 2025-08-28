export type TGateApiRes<T> = {
    method: string;
    message: string;
    code: number;
    data: T;
};
