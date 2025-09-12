// gate-rate-rules.ts
export type Basis = "IP" | "UID";

export interface GateRule {
    id: string; // nhãn rule
    limit: number; // số request tối đa trong cửa sổ
    windowMs: number; // độ dài cửa sổ
    basis: Basis; // tính theo IP hay UID
    match(method: string, url: URL): boolean; // request có khớp rule?
    bucketKey(method: string, url: URL, ctx: { uid?: string }): string; // khoá đếm
}

/** Public endpoints theo tài liệu: order book, candlesticks, pairs, funding rate, ... */
const PUBLIC_PATTERNS = [
    /\/order_?book\b/i,
    /\/candlesticks?\b/i,
    /\/(trading_)?pairs?\b/i,
    /\/funding_?rate(s)?\b/i,
    /\/tickers?\b/i,
    /\/trades?\b/i,
    /\/(mark|index)_price\b/i,
];

function isPublicEndpoint(p: string) {
    return PUBLIC_PATTERNS.some((rx) => rx.test(p));
}

function normEndpointPath(u: URL) {
    // bỏ query, giữ nguyên path để "per endpoint"
    return u.pathname.replace(/\/+/g, "/");
}

export const GateRules: GateRule[] = [
    // ---- FUTURES (USDT) ----
    // Place orders: 100 r/s (UID)
    {
        id: "futures.place",
        limit: 100,
        windowMs: 1_000,
        basis: "UID",
        match: (m, u) => m.toUpperCase() === "POST" && /\/apiw\/v2\/futures\/[^/]+\/orders$/i.test(u.pathname),
        bucketKey: (_m, u, { uid }) => `place:${uid ?? "self"}`,
    },
    // Cancel orders: 200 r/s (UID)
    {
        id: "futures.cancel",
        limit: 200,
        windowMs: 1_000,
        basis: "UID",
        match: (m, u) => (m.toUpperCase() === "DELETE" && /\/apiw\/v2\/futures\/[^/]+\/orders/i.test(u.pathname)) || /\/cancel\b/i.test(u.pathname),
        bucketKey: (_m, _u, { uid }) => `cancel:${uid ?? "self"}`,
    },
    // Private endpoints (others): 200 r / 10s per endpoint (UID)
    {
        id: "futures.private.per-endpoint",
        limit: 200,
        windowMs: 10_000,
        basis: "UID",
        match: (m, u) => {
            // Thuộc futures private nhưng KHÔNG phải place/cancel
            const isFutures = /\/apiw\/v2\/futures\//i.test(u.pathname);
            const isPlace = m.toUpperCase() === "POST" && /\/orders$/i.test(u.pathname);
            const isCancel = (m.toUpperCase() === "DELETE" && /\/orders/i.test(u.pathname)) || /\/cancel\b/i.test(u.pathname);
            return isFutures && !isPlace && !isCancel;
        },
        bucketKey: (_m, u, { uid }) => `priv:${uid ?? "self"}:${normEndpointPath(u)}`,
    },
    // Public endpoints: 200 r / 10s per endpoint (IP)
    {
        id: "public.per-endpoint",
        limit: 200,
        windowMs: 10_000,
        basis: "IP",
        match: (m, u) => m.toUpperCase() === "GET" && isPublicEndpoint(u.pathname),
        bucketKey: (_m, u) => `pub:${normEndpointPath(u)}`,
    },

    // ---- OTHERS FROM TABLE (bạn dùng thì bật, không thì để đây làm mẫu) ----
    // Delivery: place/cancel 500 r/10s (UID); Others 200 r/10s per endpoint
    {
        id: "delivery.place-cancel",
        limit: 500,
        windowMs: 10_000,
        basis: "UID",
        match: (m, u) =>
            /\/delivery\//i.test(u.pathname) &&
            ((m.toUpperCase() === "POST" && /\/orders$/i.test(u.pathname)) ||
                (m.toUpperCase() === "DELETE" && /\/orders/i.test(u.pathname)) ||
                /\/cancel\b/i.test(u.pathname)),
        bucketKey: (_m, _u, { uid }) => `delivery:pc:${uid ?? "self"}`,
    },
    {
        id: "delivery.other.per-endpoint",
        limit: 200,
        windowMs: 10_000,
        basis: "UID",
        match: (m, u) =>
            /\/delivery\//i.test(u.pathname) &&
            !(
                (m.toUpperCase() === "POST" && /\/orders$/i.test(u.pathname)) ||
                (m.toUpperCase() === "DELETE" && /\/orders/i.test(u.pathname)) ||
                /\/cancel\b/i.test(u.pathname)
            ),
        bucketKey: (_m, u, { uid }) => `delivery:priv:${uid ?? "self"}:${normEndpointPath(u)}`,
    },

    // Options: place/cancel 200 r/s; Others 200 r/10s per endpoint (UID)
    {
        id: "options.place-cancel",
        limit: 200,
        windowMs: 1_000,
        basis: "UID",
        match: (m, u) =>
            /\/options\//i.test(u.pathname) &&
            ((m.toUpperCase() === "POST" && /\/orders$/i.test(u.pathname)) ||
                (m.toUpperCase() === "DELETE" && /\/orders/i.test(u.pathname)) ||
                /\/cancel\b/i.test(u.pathname)),
        bucketKey: (_m, _u, { uid }) => `options:pc:${uid ?? "self"}`,
    },
    {
        id: "options.other.per-endpoint",
        limit: 200,
        windowMs: 10_000,
        basis: "UID",
        match: (_m, u) => /\/options\//i.test(u.pathname),
        bucketKey: (_m, u, { uid }) => `options:priv:${uid ?? "self"}:${normEndpointPath(u)}`,
    },

    // Subaccount: 80 r / 10s per endpoint (UID)
    {
        id: "subaccount.per-endpoint",
        limit: 80,
        windowMs: 10_000,
        basis: "UID",
        match: (_m, u) => /\/subaccount/i.test(u.pathname) || /\/sub-?accounts?/i.test(u.pathname),
        bucketKey: (_m, u, { uid }) => `sub:${uid ?? "self"}:${normEndpointPath(u)}`,
    },

    // Unified borrow/repay: 15 / 10s (POST /unified/loans)
    {
        id: "unified.borrow-repay",
        limit: 15,
        windowMs: 10_000,
        basis: "UID",
        match: (m, u) => m.toUpperCase() === "POST" && /\/unified\/loans\b/i.test(u.pathname),
        bucketKey: (_m, _u, { uid }) => `unified:loans:${uid ?? "self"}`,
    },
];

/** Trả rule đầu tiên khớp (ưu tiên place/cancel trước) */
export function pickRule(method: string, urlStr: string): GateRule | null {
    const url = new URL(urlStr);
    for (const r of GateRules) if (r.match(method, url)) return r;
    return null;
}
