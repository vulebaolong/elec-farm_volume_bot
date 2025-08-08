import { TPosition } from './position.type';

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
