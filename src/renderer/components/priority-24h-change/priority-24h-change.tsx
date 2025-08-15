"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/hooks/socket.hook";
import { useGetPriority24Change } from "@/api/tanstack/priority-24h-change.tanstack";
import { TPayload24Change } from "@/types/priority-change.type";
import { WhitelistSentiment } from "./whitelist-sentiment/whitelist-sentiment";
import { useAppSelector } from "@/redux/store";

export default function Priority24hChange() {
    const socket = useSocket();
    const queryClient = useQueryClient();
    const max24hChangeGreen = useAppSelector((state) => state.user.info?.SettingUsers.max24hChangeGreen);
    const max24hChangeRed = useAppSelector((state) => state.user.info?.SettingUsers.max24hChangeRed);

    // 1) lấy snapshot ban đầu (server)
    const getPriority24Change = useGetPriority24Change();

    // 2) nạp live bằng socket -> ghi vào cache
    useEffect(() => {
        if (!socket?.socket) return;

        const handle24hChange = ({ data: incoming }: { data: TPayload24Change }) => {
            queryClient.setQueryData<TPayload24Change>(["get-priority-24h-chang"], (prev) => {
                // nếu chưa có, nhận luôn
                if (!prev) return incoming;

                const same =
                    prev.countGreen === incoming.countGreen &&
                    prev.countRed === incoming.countRed &&
                    prev.countTotalWhiteList === incoming.countTotalWhiteList;
                if (same) return prev;

                return incoming;
            });
        };

        socket.socket.on("24hChange", handle24hChange);
        return () => {
            socket.socket?.off("24hChange", handle24hChange);
        };
    }, [socket?.socket, queryClient]);

    // 3) render: chỉ đọc từ query data
    return (
        <WhitelistSentiment
            isLoading={getPriority24Change.isLoading}
            green={getPriority24Change.data?.countGreen ?? 0}
            red={getPriority24Change.data?.countRed ?? 0}
            total={getPriority24Change.data?.countTotalWhiteList ?? 0}
            thresholdLong={max24hChangeGreen}
            thresholdShort={max24hChangeRed}
        />
    );
}
