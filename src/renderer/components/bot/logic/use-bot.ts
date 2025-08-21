import api from "@/api/axios/app.axios";
import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { ENDPOINT } from "@/constant/endpoint.constant";
import { useSocket } from "@/hooks/socket.hook";
import { SET_UI_SELECTOR } from "@/redux/slices/bot.slice";
import { SET_INFO } from "@/redux/slices/user.slice";
import { useAppDispatch } from "@/redux/store";
import { TRes } from "@/types/app.type";
import { TSocketRes } from "@/types/base.type";
import { TContract } from "@/types/contract.type";
import { TPayload24Change } from "@/types/priority-change.type";
import { TSettingUsers } from "@/types/setting-user.type";
import { SymbolState, TSymbols } from "@/types/symbol.type";
import { TUiSelector } from "@/types/ui-selector.type";
import { TUser } from "@/types/user.type";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Bot, TBotConfig, TNewBot } from "./class-bot";

export function useBot(webview: Electron.WebviewTag | null) {
    const botRef = useRef<Bot>(null);
    const dispatch = useAppDispatch();
    const getInfoMoutation = useGetInfoMutation();
    const socket = useSocket();
    const queryClient = useQueryClient();

    // 1) Tải dữ liệu khởi tạo (chỉ chạy một lần)
    useEffect(() => {
        if (!webview || !socket?.socket) return;

        const handleSettingUser = ({ data }: TSocketRes<TSettingUsers>) => {
            // console.log({ handleSettingUser: data });
            getInfoMoutation.mutate();
            botRef.current?.setSettingUser(data);
        };
        const handleUiSelector = ({ data }: TSocketRes<TUiSelector[]>) => {
            // console.log({ handleUiSelector: data });
            dispatch(SET_UI_SELECTOR(data));
            botRef.current?.setUiSelector(data);
        };
        const handleEntry = ({ data }: TSocketRes<SymbolState[]>) => {
            // console.log({ handleEntry: data });
            botRef.current?.setSymbolEntry(data);
        };
        const handle24hChange = ({ data }: TSocketRes<TPayload24Change>) => {
            queryClient.setQueryData<TPayload24Change>(["get-priority-24h-chang"], (prev) => {
                // nếu chưa có, nhận luôn
                if (!prev) return data;

                const same =
                    prev.countGreen === data.countGreen && prev.countRed === data.countRed && prev.countTotalWhiteList === data.countTotalWhiteList;
                if (same) return prev;

                return data;
            });
            botRef.current?.setPriority24hChange(data);
        };
        const handleSymbolsForClosePosition = ({ data }: TSocketRes<TSymbols>) => {
            botRef.current?.setSymbolsForClosePosition(data);
        };

        (async () => {
            console.log(11111);
            try {
                const { data: uiSelector } = await api.get<TRes<TUiSelector[]>>(ENDPOINT.UI_SELECTOR.GET_UI_SELECTOR);
                console.log({ "uiSelector hoàn thành": uiSelector });
                dispatch(SET_UI_SELECTOR(uiSelector.data));

                const { data: settingUser } = await api.get<TRes<TUser>>(ENDPOINT.AUTH.GET_INFO);
                console.log({ "settingUser hoàn thành": settingUser });
                dispatch(SET_INFO(settingUser.data));

                const { data: priority24hChange } = await api.get<TRes<TPayload24Change>>(ENDPOINT.PRIORITY_24h_CHANGE.GET_PRIORITY_24h_CHANGE);
                console.log({ "priority24hChange hoàn thành": priority24hChange });

                const { data: contractsArray } = await api.get<TRes<TContract[]>>(ENDPOINT.CONTRACT.GET_CONTRACT);
                console.log({ "contractsArray hoàn thành": contractsArray });
                const contracts = new Map<string, TContract>();
                contractsArray.data.forEach((contract) => {
                    contracts.set(contract.symbol, contract);
                })

                const positions = await Bot.getPositions(webview);
                const orderOpens = await Bot.getOrderOpens(webview);

                const initConfigBot: TBotConfig = {
                    uiSelector: uiSelector.data,
                    settingUser: settingUser.data.SettingUsers,
                    priority24hChange: priority24hChange.data,
                    contracts: contracts,
                };

                const newBot: TNewBot = {
                    configBot: initConfigBot,
                    webview,
                    orderOpens,
                    positions,
                };

                botRef.current = new Bot(newBot);
                botRef.current.start();

                socket?.socket?.on("setting-user", handleSettingUser);
                socket?.socket?.on("ui-selector", handleUiSelector);
                socket?.socket?.on("entry", handleEntry);
                socket?.socket?.on("24hChange", handle24hChange);
                socket?.socket?.on("symbols-for-close-position", handleSymbolsForClosePosition);
            } catch (error) {
                console.error("❌ Lỗi trong qúa trình start bot =====>", error);
            }
        })();

        return () => {
            socket.socket?.off("setting-user", handleSettingUser);
            socket.socket?.off("ui-selector", handleUiSelector);
            socket.socket?.off("entry", handleEntry);
            socket.socket?.off("24hChange", handle24hChange);
            socket.socket?.off("symbols-for-close-position", handleSymbolsForClosePosition);
        };
    }, [webview, socket?.socket]);

    return {
        botRef,
    };
}
