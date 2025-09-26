// click-market-position.types.ts
import { TSide } from "./base.type";
import type { WorkerRpcRequest, WorkerRpcResponse } from "./shared-ipc.types";

export interface ClickMarketPositionParams {
    symbol: string; // ví dụ "BTC_USDT" hoặc "BTC/USDT"
    side: TSide; // 'long' | 'short'
    selectors: {
        wrapperPositionBlocks: string; // CSS selector của vùng chứa các block position
        tabPositionsButton: string; // CSS selector của tab chuyển sang trang Positions
    };
}

/** Kết quả do script chạy trong trang trả về (executeJavaScript) */
export interface ClickMarketPositionScriptResult {
    ok: boolean;
    data: boolean | null;
    error: string | null;
}

/** Payload yêu cầu gửi sang main/renderer để thực thi script */
export interface ClickMarketPositionRequestPayload extends WorkerRpcRequest {
    script: string;
}

/** Payload phản hồi từ main/renderer về worker */
export type ClickMarketPositionResponsePayload = WorkerRpcResponse<boolean>;

/** Tên channel IPC dùng thống nhất */
export const CLICK_MARKET_POSITION_REQ = "bot:clickMarketPosition:req";
export const CLICK_MARKET_POSITION_RES = "bot:clickMarketPosition:res";
