export type TBidsAsks = {
    current: number;
    update: number;
    asks: Ask[];
    bids: Bid[];
};

export type Ask = {
    s: number;
    p: string;
};

export type Bid = {
    s: number;
    p: string;
};
