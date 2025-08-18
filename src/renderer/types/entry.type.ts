import { TCloseOrder, TOpenOrder } from "@/javascript-string/logic-farm";
import { TSide } from "./base.type";

export type THandleOpenEntry = {
    webview: Electron.WebviewTag;
    payload: TPayloadClickOpenEntry;
    flag?: string
    selector: TOpenOrder["selector"];
};

export type THandleCloseEntry = {
    webview: Electron.WebviewTag;
    payload: TPayloadClickOpenEntry;
    flag?: string
    selector: TCloseOrder["selector"];
};

export type TPayloadClickOpenEntry = {
    symbol: string;
    size: string;
    side: TSide;
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
