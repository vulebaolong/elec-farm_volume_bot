export type TFuturesOrderBook = {
    channel: string;
    event: string;
    result: TResultFuturesOrderBook;
    time: number;
    time_ms: number;
};

export type TResultFuturesOrderBook = {
    asks: TAskFuturesOrderBook[];
    bids: TBidFuturesOrderBook[];
    contract: string;
    id: number;
    l: string;
    t: number;
};

export type TAskFuturesOrderBook = {
    p: string;
    s: number;
};

export type TBidFuturesOrderBook = {
    p: string;
    s: number;
};
