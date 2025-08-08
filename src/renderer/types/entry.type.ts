export type THandleEntry = {
    webview: Electron.WebviewTag;
    payload: TPayloadClickOpenEntry;
    flag?: string
};

export type TPayloadClickOpenEntry = {
    symbol: string;
    size: string;
    side: "long" | "short";
};

export type TSocketEntry = {
    symbol: string;
    spreadPercent: number;
    imbalanceBidPercent: number;
    imbalanceAskPercent: number;
    bidUSD: number;
    askUSD: number;
    flags: Flags;
    lastPrice: number;
};

export interface Flags {
    isSpreadPercent: boolean;
    isLong: boolean;
    isShort: boolean;
    isDepth: boolean;
}
