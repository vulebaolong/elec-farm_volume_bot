"use client";

import { useGetPriority24Change } from "@/api/tanstack/priority-24h-change.tanstack";
import { useAppSelector } from "@/redux/store";
import { Bot } from "../bot/logic/class-bot";
import { WhitelistSentiment } from "./whitelist-sentiment/whitelist-sentiment";
import { TWhitelistUi } from "@/types/white-list.type";

type TProps = {
    botRef: React.RefObject<Bot | null>;
};

export default function Priority24hChange({ botRef }: TProps) {
    const max24hChangeGreen = useAppSelector((state) => state.user.info?.SettingUsers.max24hChangeGreen);
    const max24hChangeRed = useAppSelector((state) => state.user.info?.SettingUsers.max24hChangeRed);

    // 1) lấy snapshot ban đầu (server)
    const getPriority24Change = useGetPriority24Change();

    // 3) render: chỉ đọc từ query data
    return (
        <div className="px-5">
            <WhitelistSentiment
                isLoading={getPriority24Change.isLoading}
                green={getPriority24Change.data?.countGreen ?? 0}
                red={getPriority24Change.data?.countRed ?? 0}
                total={getPriority24Change.data?.countTotalWhiteList ?? 0}
                thresholdLong={max24hChangeGreen}
                thresholdShort={max24hChangeRed}
                botRef={botRef}
                whitelistUi={[]}
            />
        </div>
    );
}
