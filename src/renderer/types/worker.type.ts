export type TWorkerData<T> = {
    type: string;
    payload: T;
};

export type TWorkerMetrics = {
    threadId: number;
    ts: number;
    heapUsed: number; // bytes
    heapTotal: number; // bytes
    v8: any; // isolate stats của worker
    eventLoop: {
        mean: number; // ms
        max: number;
        p95: number;
    };
};

export type TWorkerHeartbeat = {
    ts: number;
    isStart: boolean;
};
