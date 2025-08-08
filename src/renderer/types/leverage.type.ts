export type TPayloadLeverage = {
  symbol: string;
  leverage: string;
};

export interface TLeverageRes {
  method: string;
  message: string;
  code: number;
  data: TLeverageData[];
}

export interface TLeverageData {
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
}
