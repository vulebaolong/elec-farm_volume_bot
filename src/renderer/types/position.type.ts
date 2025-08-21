export interface TPositionRes {
    method: string;
    message: string;
    code: number;
    data: TPosition[] | null;
}

export type TPosition = {
    value: string;
    leverage: string;
    mode: string;
    realised_point: string;
    contract: string;
    entry_price: string;
    mark_price: string;
    last_price: string;
    history_point: string;
    realised_pnl: string;
    close_order: any;
    size: number;
    cross_leverage_limit: string;
    pending_orders: number;
    adl_ranking: number;
    maintenance_rate: string;
    unrealised_pnl: string;
    pnl_pnl: string;
    pnl_fee: string;
    pnl_fund: string;
    user: number;
    leverage_max: string;
    history_pnl: string;
    risk_limit: string;
    margin: string;
    last_close_pnl: string;
    liq_price: string;
    update_time: number;
    open_time: number;
    update_id: number;
    margin_rate: string;
    position_profit: string;
    future_auto_order: any;
    future_plan_order: any;
    future_reverse_order: any;
    future_trail_order: any;
    future_mmr_order: any;
    initial_margin: string;
    maintenance_margin: string;
    trade_max_size: string;
    risk_limit_table: string;
    tiers: any;
    average_maintenance_rate: string;
    voucher_size: string;
    voucher_margin: string;
    voucher_id: number;
};

/**
{
    "value": "9.376",
    "leverage": "50",
    "mode": "dual_long",
    "realised_point": "0",
    "contract": "AI16Z/USDT",
    "entry_price": "0.1152",
    "mark_price": "0.1172",
    "last_price": "0.1173",
    "history_point": "0",
    "realised_pnl": "-0.0023052",
    "close_order": null,
    "size": 8,
    "cross_leverage_limit": "0",
    "pending_orders": 1,
    "adl_ranking": 1,
    "maintenance_rate": "0.01",
    "unrealised_pnl": "0.16",
    "pnl_pnl": "0",
    "pnl_fee": "-0.0018432",
    "pnl_fund": "-0.000462",
    "user": 31674740,
    "leverage_max": "75",
    "history_pnl": "0.135176628",
    "risk_limit": "20000",
    "margin": "0.19077",
    "last_close_pnl": "-0.0388496",
    "liq_price": "0.1136",
    "update_time": 1755662400,
    "open_time": 1755659748,
    "update_id": 88,
    "margin_rate": "5.5424",
    "position_profit": "5.19987",
    "future_auto_order": [],
    "future_plan_order": [],
    "future_reverse_order": [],
    "future_trail_order": null,
    "future_mmr_order": [],
    "initial_margin": "0.194552",
    "maintenance_margin": "0.063288",
    "trade_max_size": "0",
    "risk_limit_table": "AI16Z_USDT_202505120315",
    "tiers": [
        {
            "tier": 1,
            "risk_limit": "5000",
            "initial_rate": "0.013333",
            "maintenance_rate": "0.006",
            "leverage_max": "75",
            "deduction": "0"
        },
        {
            "tier": 2,
            "risk_limit": "10000",
            "initial_rate": "0.016666",
            "maintenance_rate": "0.008",
            "leverage_max": "60",
            "deduction": "10"
        },
        {
            "tier": 3,
            "risk_limit": "20000",
            "initial_rate": "0.02",
            "maintenance_rate": "0.01",
            "leverage_max": "50",
            "deduction": "30"
        },
        {
            "tier": 4,
            "risk_limit": "30000",
            "initial_rate": "0.025",
            "maintenance_rate": "0.0125",
            "leverage_max": "40",
            "deduction": "80"
        },
        {
            "tier": 5,
            "risk_limit": "50000",
            "initial_rate": "0.0303",
            "maintenance_rate": "0.015",
            "leverage_max": "33",
            "deduction": "155"
        },
        {
            "tier": 6,
            "risk_limit": "70000",
            "initial_rate": "0.03333",
            "maintenance_rate": "0.02",
            "leverage_max": "30",
            "deduction": "405"
        },
        {
            "tier": 7,
            "risk_limit": "100000",
            "initial_rate": "0.05",
            "maintenance_rate": "0.03",
            "leverage_max": "20",
            "deduction": "1105"
        },
        {
            "tier": 8,
            "risk_limit": "150000",
            "initial_rate": "0.0625",
            "maintenance_rate": "0.04",
            "leverage_max": "16",
            "deduction": "2105"
        },
        {
            "tier": 9,
            "risk_limit": "200000",
            "initial_rate": "0.0714",
            "maintenance_rate": "0.05",
            "leverage_max": "14",
            "deduction": "3605"
        },
        {
            "tier": 10,
            "risk_limit": "300000",
            "initial_rate": "0.0833",
            "maintenance_rate": "0.065",
            "leverage_max": "12",
            "deduction": "6605"
        },
        {
            "tier": 11,
            "risk_limit": "500000",
            "initial_rate": "0.1",
            "maintenance_rate": "0.08",
            "leverage_max": "10",
            "deduction": "11105"
        },
        {
            "tier": 12,
            "risk_limit": "700000",
            "initial_rate": "0.125",
            "maintenance_rate": "0.1",
            "leverage_max": "8",
            "deduction": "21105"
        },
        {
            "tier": 13,
            "risk_limit": "1000000",
            "initial_rate": "0.2",
            "maintenance_rate": "0.15",
            "leverage_max": "5",
            "deduction": "56105"
        },
        {
            "tier": 14,
            "risk_limit": "1500000",
            "initial_rate": "0.25",
            "maintenance_rate": "0.2",
            "leverage_max": "4",
            "deduction": "106105"
        },
        {
            "tier": 15,
            "risk_limit": "2000000",
            "initial_rate": "0.333",
            "maintenance_rate": "0.28",
            "leverage_max": "3",
            "deduction": "226105"
        },
        {
            "tier": 16,
            "risk_limit": "2500000",
            "initial_rate": "0.5",
            "maintenance_rate": "0.45",
            "leverage_max": "2",
            "deduction": "566105"
        },
        {
            "tier": 17,
            "risk_limit": "3000000",
            "initial_rate": "0.666",
            "maintenance_rate": "0.6",
            "leverage_max": "1.5",
            "deduction": "941105"
        },
        {
            "tier": 18,
            "risk_limit": "4000000",
            "initial_rate": "0.83",
            "maintenance_rate": "0.78",
            "leverage_max": "1.2",
            "deduction": "1481105"
        },
        {
            "tier": 19,
            "risk_limit": "5000000",
            "initial_rate": "0.95",
            "maintenance_rate": "0.9",
            "leverage_max": "1.05",
            "deduction": "1961105"
        }
    ],
    "average_maintenance_rate": "0.006",
    "voucher_size": "0",
    "voucher_margin": "0",
    "voucher_id": 0
}
 */

/**
{
    "method": "/apiw/v2/futures/usdt/orders",
    "message": "success",
    "code": 200,
    "data": {
        "refu": 0,
        "tkfr": "0.0005",
        "mkfr": "0.0002",
        "contract": "AI16Z_USDT",
        "id": 7318350020256439,
        "id_string": "7318350020256439",
        "price": "0",
        "tif": "ioc",
        "iceberg": 0,
        "text": "web",
        "user": 31674740,
        "is_reduce_only": false,
        "is_close": false,
        "is_liq": false,
        "fill_price": "0.1171",
        "create_time": 1755665754.523,
        "finish_time": 1755665754.523,
        "finish_as": "filled",
        "status": "finished",
        "left": 0,
        "refr": "0",
        "size": -1,
        "biz_info": "dual",
        "amend_text": "-",
        "stp_act": "-",
        "stp_id": 0,
        "update_id": 1,
        "pnl": "0",
        "pnl_margin": "0",
        "bbo": "-"
    }
}
 */
