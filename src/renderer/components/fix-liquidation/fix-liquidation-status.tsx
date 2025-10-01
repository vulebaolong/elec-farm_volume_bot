import { useAppSelector } from "@/redux/store";
import { EStatusFixLiquidation } from "@/types/enum/fix-liquidation.enum";
import { TFixLiquidationInDB } from "@/types/fix-liquidation.type";
import { CircleCheck, CircleX } from "lucide-react";
import { GithubCiSpinner } from "../ci-spinner/github-ci-spinner";

type TProps = {
    item: TFixLiquidationInDB;
};

export default function FixLiquidationStatus({ item }: TProps) {
    const isRunning = useAppSelector((state) => state.bot.isRunning);
    const isStart = useAppSelector((state) => state.bot.isStart);
    const stopLoss = useAppSelector((state) => state.user.info?.SettingUsers.stopLoss);

    if (item.status === EStatusFixLiquidation.PROCESSING) {
        return (
            <GithubCiSpinner
                state={item.data.dataLiquidationShouldFix && (!isRunning || isStart) && (stopLoss ?? 0) >= 100 ? "start" : "stop"}
                stopVisual="ring"
                size={14}
                gapRatio={0.2}
                color="var(--mantine-color-green-6)"
            />
        );
    }
    if (item.status === EStatusFixLiquidation.SUCCESS) {
        return <CircleCheck size={16} color="var(--mantine-color-green-6)" />;
    }
    return <CircleX size={16} color="var(--mantine-color-red-6)" />;
}
