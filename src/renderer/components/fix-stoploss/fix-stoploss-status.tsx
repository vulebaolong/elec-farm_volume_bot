import { useAppSelector } from "@/redux/store";
import { EStatusFixLiquidation } from "@/types/enum/fix-liquidation.enum";
import { TFixStopLossInDB } from "@/types/fix-stoploss.type";
import { CircleCheck, CircleX } from "lucide-react";
import { GithubCiSpinner } from "../ci-spinner/github-ci-spinner";
import { EStatusFixStopLoss } from "@/types/enum/fix-stoploss.enum";

type TProps = {
    item: TFixStopLossInDB;
};

export default function FixStopLossStatus({ item }: TProps) {
    const isRunning = useAppSelector((state) => state.bot.isRunning);
    const isStart = useAppSelector((state) => state.bot.isStart);
    const stopLoss = useAppSelector((state) => state.user.info?.SettingUsers.stopLoss);

    if (item.status === EStatusFixStopLoss.PROCESSING) {
        return (
            <GithubCiSpinner
                state={item.data.dataStopLossShouldFix && (!isRunning || isStart) && (stopLoss ?? 0) < 100 ? "start" : "stop"}
                stopVisual="ring"
                size={14}
                gapRatio={0.2}
                color="var(--mantine-color-green-6)"
            />
        );
    }
    if (item.status === EStatusFixStopLoss.SUCCESS) {
        return <CircleCheck size={16} color="var(--mantine-color-green-6)" />;
    }
    return <CircleX size={16} color="var(--mantine-color-red-6)" />;
}
