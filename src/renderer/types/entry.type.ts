import { TCloseOrder, TOpenOrder, TOpenOrderPostOnly } from "@/javascript-string/logic-farm";
import { TSide } from "./base.type";

export type THandleOpenEntry = {
    webview: Electron.WebviewTag;
    payload: TPayloadClickOpenEntry;
    flag?: string
    selector: TOpenOrder["selector"];
};

export type THandleOpenPostOnlyEntry = {
    webview: Electron.WebviewTag;
    payload: TPayloadClickOpenPostOnlyEntry;
    flag?: string
    selector: TOpenOrderPostOnly["selector"];
};

export type THandleCloseEntry = {
    webview: Electron.WebviewTag;
    payload: TPayloadClickOpenEntry;
    flag?: string
    selector: TCloseOrder["selector"];
};

export type TPayloadClickOpenEntry = {
    symbol: string;
    side: TSide;
};

export type TPayloadClickOpenPostOnlyEntry = {
    symbol: string;
    size: string;
    price: string;
    reduce_only: boolean
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
