import { roleAllowed } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { BotIcon } from "lucide-react";
import Log from "../log/log";
import SideCountIoc from "../side-count-ioc/side-count-ioc";
import { PageTitle } from "../title-page/title-page";
import Controll from "./controll";

export default function Bot() {
    const info = useAppSelector((state) => state.user.info);

    return (
        <div className="">
            <PageTitle title={"Bot"} icon={BotIcon} size="md" />

            <div className="flex flex-col gap-5 h-full p-5">
                <Controll />
                {roleAllowed(info?.roleId) && (
                    <>
                        {/* <FixLiquidation /> */}
                        {/* <FixStopLoss /> */}
                        <SideCountIoc />
                        <Log />
                        {/* <PassiveSticky /> */}
                        {/* <TakeprofitAccount /> */}
                        {/* <RateCounter /> */}
                        {/* <SessionsManager /> */}
                    </>
                )}
            </div>
        </div>
    );
}
