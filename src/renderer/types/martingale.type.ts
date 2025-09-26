import { THistoryAggregate } from "./bot.type";
import { TOrderOpen } from "./order.type";

export type MartingaleOption = {
    inputUSDT: number;
    leverage: number;
};

export type MartingaleConfig = {
    initialInputUSDT: number;
    initialLeverage: number;
    options: MartingaleOption[];
};

export type TDataFixLiquidation = {
    dataLiquidationShouldFix: THistoryAggregate;
    dataOrderOpenFixLiquidation: TOrderOpen | null;
    dataCloseTP: TOrderOpen | null;
};

export type MartingaleSummary = {
    status: "idle" | "fixing";
    targetContract: string | null; // contract bị thanh lý cần fix
    step: number | null; // nếu worker có kèm step
    liquidationFinishTime: number | null; // thời điểm liq finish (sec)

    openFixContract: string | null;
    openFixPrice: string | null;
    openFixSize?: string | number | null;
    openFixCreateTime: number | null;

    tpContract: string | null;
    tpPrice: string | null;
    tpSize?: string | number | null;
    tpCreateTime: number | null;

    updatedAt: number; // ms
};
