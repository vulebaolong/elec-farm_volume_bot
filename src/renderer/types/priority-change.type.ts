import { TSide } from "./base.type";

export type TTicker24hChange = {
    period: number;
    open: string;
    close: string;
    high: string;
    low: string;
    last: string;
    change: string;
    quoteVolume: string;
    baseVolume: string;
    changePrice: string;
    t: number;
};
export type TPayload24Change = {
    countTotalWhiteList: number;
    countTotalGreenRed: number;
    countGreen: number;
    countRed: number;
};

export type TPriority = TSide | "normal";
