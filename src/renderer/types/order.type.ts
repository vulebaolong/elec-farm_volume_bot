export interface TGetOrderOpenRes {
  method: string
  message: string
  code: number
  data: TOrderOpen[] | null
}

export interface TEntryOrderOpenRes {
  method: string
  message: string
  code: number
  data: TOrderOpen | null
}

export type TOrderOpen = {
  refu: number
  tkfr: string
  mkfr: string
  contract: string
  id: number
  id_string: string
  price: string
  tif: string
  iceberg: number
  text: string
  user: number
  is_reduce_only: boolean
  is_close: boolean
  is_liq: boolean
  fill_price: string
  create_time: number
  finish_time: number
  finish_as: string
  status: string
  left: number
  refr: string
  size: number
  biz_info: string
  amend_text: string
  stp_act: string
  stp_id: number
  update_id: number
  pnl: string
  pnl_margin: string
}
