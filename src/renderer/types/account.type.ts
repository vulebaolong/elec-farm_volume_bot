export type TAccount = {
    order_margin: string;
    point: string;
    bonus: string;
    history: History;
    unrealised_pnl: string;
    total: string;
    available: string;
    enable_credit: boolean;
    in_dual_mode: boolean;
    currency: string;
    asset: string;
    position_margin: string;
    user: number;
    update_time: number;
    portfolio_margin_total_equity: string;
    portfolio_margin_total_borrowed: string;
    credit_available_margin: string;
    total_initial_margin_rate: string;
    total_maintenance_margin_rate: string;
    total_margin_balance: string;
    is_default_value: boolean;
    margin_mode: number;
    maintenance_margin: string;
    enable_evolved_classic: boolean;
    cross_initial_margin: string;
    cross_maintenance_margin: string;
    cross_order_margin: string;
    cross_unrealised_pnl: string;
    cross_available: string;
    isolated_position_margin: string;
    margin_mode_name: string;
    cross_balance: string;
    iso_balance: string;
    im: string;
    mm: string;
    imr: string;
    mmr: string;
    margin_balance: string;
    available_margin: string;
    enable_tiered_mm: boolean;
    position_voucher_total: string;
};

export interface History {
    dnw: string;
    pnl: string;
    refr: string;
    point_fee: string;
    fund: string;
    bonus_dnw: string;
    point_refr: string;
    bonus_offset: string;
    fee: string;
    point_dnw: string;
}

export type TSaveAccountReq = {
    user: number;
    source: string;
    margin_mode_name: string;
    in_dual_mode: boolean;
    total: string;
    available: string;
    cross_available: string;
    isolated_position_margin: string;
    cross_initial_margin: string;
    cross_maintenance_margin: string;
    unrealised_pnl: string;
    update_time: number;
};

export type TSavePositionAccountReq = {
    user: number;
    source: string;
    totalOpenPO: number;
    poPerToken: Record<string, number>;
};

export type TUpsertAccountReq = {
    data: any;
};
