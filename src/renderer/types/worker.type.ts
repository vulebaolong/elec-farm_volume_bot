import { LogLevel } from "electron-log";

export type TWorkerData<T> = {
    type: string;
    payload: T;
};

export type TWorkerHeartbeat = {
    ts: number;
    isStart: boolean;
    isRunning: boolean;
};

export type TWorkLog = {
    level: LogLevel;
    text: any;
};
