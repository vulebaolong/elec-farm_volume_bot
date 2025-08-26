export interface TGetMyTradesRes {
  method: string
  message: string
  code: number
  data: TMyTrade[] | null
}

export type TMyTrade = {
  trade_id: string
  contract: string
  create_time: number
  size: number
  price: string
  order_id: string
  fee: string
  point_fee: string
  role: string
  text: string
  biz_info: string
  amend_text: string
  position_side: string
  position_side_output: string
  close_size: number
}

export type Book = { bidBest: number; askBest: number; order_price_round: number };
