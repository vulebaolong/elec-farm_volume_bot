import { BotIcon } from "lucide-react";
import FixLiquidation from "../fix-liquidation/fix-liquidation";
import Log from "../log/log";
import PassiveSticky from "../log/terminal-log/passive-sticky";
import RateCounter from "../rate-counter/rate-counter";
import TakeprofitAccount from "../takeprofit-account/takeprofit-account";
import { PageTitle } from "../title-page/title-page";
import Controll from "./controll";
import FixStopLoss from "../fix-stoploss/fix-stoploss";

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
                {/* <RateCountsPanel /> */}
            </div>
        </div>
    );
}

/**
{
    "contract": "AI16Z_USDT",
    "side": "long",
    "size": "-1",
    "price": "0.1187"
}
 */

/**
{
    "contract": "AI16Z_USDT",
    "side": "long",
    "size": "-1",
    "price": "0.1187"
}
 */
