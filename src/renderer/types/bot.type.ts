import { TSettingUsers } from "./setting-user.type";
import { TUiSelector } from "./ui-selector.type";

export type TDataInitBot = {
    parentPort: import("worker_threads").MessagePort;
    settingUser: TSettingUsers;
    uiSelector: TUiSelector[];
    blackList: string[];
};

export type TChangeLeverage = {
    adl_ranking: number;
    average_maintenance_rate: string;
    close_order: any;
    contract: string;
    cross_leverage_limit: string;
    entry_price: string;
    history_pnl: string;
    history_point: string;
    initial_margin: string;
    last_close_pnl: string;
    leverage: string;
    leverage_max: string;
    liq_price: string;
    maintenance_margin: string;
    maintenance_rate: string;
    margin: string;
    mark_price: string;
    mode: string;
    open_time: number;
    pending_orders: number;
    pnl_fee: string;
    pnl_fund: string;
    pnl_pnl: string;
    realised_pnl: string;
    realised_point: string;
    risk_limit: string;
    risk_limit_table: string;
    size: number;
    trade_max_size: string;
    unrealised_pnl: string;
    update_id: number;
    update_time: number;
    user: number;
    value: string;
    voucher_id: number;
    voucher_margin: string;
    voucher_size: string;
};

export type TPayloadOrder = {
    contract: string;
    price: string;
    reduce_only: boolean;
    size: string;
};

export type TDataOrder = {
    reqOrderId: number;
    selector: TUiSelectorOrder;
    payloadOrder: TPayloadOrder;
};

export type TUiSelectorOrder = {
    inputPrice: string;
    inputPosition: string;
    buttonLong: string;
};

export type StickySetPayload = { key: string; text: string; ts: number };

export type FetchOK = { ok: true; res: { ok: boolean; status: number; body: string } };
export type FetchErr = { ok: false; error: string };
export type FetchResult = FetchOK | FetchErr;

export type OpenOk = { ok: true; result: any }; // result = JSON đã parse
export type OpenErr = { ok: false; error: string };
export type OpenRes = OpenOk | OpenErr;

export type TFectMainRes = {
    ok: boolean;
    bodyText: string;
    error: string | null;
};

export type TFectWorkRes<T> = {
    ok: boolean;
    body: T | null;
    error: string | null;
};

export type TGateFectMainRes = {
    ok: boolean;
    bodyText: string;
    error: string | null;
    reqId: number;
};

export type TOrderWorkRes<T> = {
    ok: boolean;
    body: T | null;
    error: string | null;
};

export type TGateOrderMainRes = {
    ok: boolean;
    bodyText: string;
    error: string | null;
    reqOrderId: number;
};

export type TResultClickOpenOrder = {
    ok: boolean;
    data: { message: string; data: string | null }[] | null;
    error: string | null;
};

export type TClickTabOpenOrderRes<T> = {
    ok: boolean;
    body: T | null;
    error: string | null;
};
export type TPayloadClickTabOpenOrder = {
    stringClickTabOpenOrder: string;
    reqClickTabOpenOrderId: number;
};
export type TResultClickTabOpenOrder = {
    ok: boolean;
    data: boolean | null;
    error: string | null;
};
export type TGateClickTabOpenOrderRes = {
    ok: boolean;
    body: boolean | null;
    error: string | null;
    reqClickTabOpenOrderId: number;
};

export type TResultClickCancelOpen = {
    ok: boolean;
    data: { scanned: number; clicked: number; skipped: number; contract: string } | null;
    error: string | null;
};
export type TClickCancelAllOpenRes<T> = {
    ok: boolean;
    body: T | null;
    error: string | null;
};
export type TPayloadClickCancelAllOpen = {
    stringClickCanelAllOpen: string;
    reqClickCanelAllOpenOrderId: number;
};
export type TGateClickCancelAllOpenRes = {
    ok: boolean;
    body: TResultClickCancelOpen["data"] | null;
    error: string | null;
    reqClickCanelAllOpenOrderId: number;
};

export type TPayloadFollowApi = {
    method: string;
    url: string;
    status?: number;
    bodyText: string;
};
