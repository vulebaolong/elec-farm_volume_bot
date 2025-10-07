import { BotIcon } from "lucide-react";
import FixLiquidation from "../fix-liquidation/fix-liquidation";
import FixStopLoss from "../fix-stoploss/fix-stoploss";
import Log from "../log/log";
import PassiveSticky from "../log/passive-sticky";
import RateCounter from "../rate-counter/rate-counter";
import TakeprofitAccount from "../takeprofit-account/takeprofit-account";
import { PageTitle } from "../title-page/title-page";
import Controll from "./controll";

export default function Bot() {
    return (
        <div className="">
            <PageTitle title={"Bot"} icon={BotIcon} size="md" />

            <div className="flex flex-col gap-5 h-full p-5">
                {/* <GateDockPanel /> */}
                <Controll />
                <RateCounter />
                <FixLiquidation />
                <FixStopLoss />
                <Log />
                <PassiveSticky />
                <TakeprofitAccount />
            </div>
        </div>
    );
}
