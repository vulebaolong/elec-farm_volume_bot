import { SET_SETTING_SYSTEM, SET_SYMBOLS_STATE, SET_WHITELIST_RESET_IN_PROGRESS } from "@/redux/slices/bot.slice";
import { useAppDispatch } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { TSettingSystemsSocket } from "@/types/setting-system.type";
import { useEffect } from "react";
import { useSocket } from "./socket.hook";
import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { useGetUiSelector } from "@/api/tanstack/selector.tanstack";
import { TSymbols } from "@/types/symbol.type";

export const useInitData = () => {
    const socket = useSocket();
    const dispatch = useAppDispatch();
    const getInfoMoutation = useGetInfoMutation();
    useGetUiSelector();

    useEffect(() => {
        if (!socket?.socket) return;

        // cập nhật setting system
        const handleSettingSystem = ({ data }: TSocketRes<TSettingSystemsSocket>) => {
            console.log({ handleSettingSystem: data });
            dispatch(SET_SETTING_SYSTEM(data));
        };
        socket.socket.on("setting-system", handleSettingSystem);

        // cập nhật setting user - chỉ cần getinfo lại
        const handleSettingUser = ({ data }: TSocketRes<TSettingSystemsSocket>) => {
            console.log({ handleSettingUser: data });
            getInfoMoutation.mutate();
        };
        socket.socket.on("setting-user", handleSettingUser);

        // tránh vào lệnh trong khi đang reset whitelist
        const handleBlockEntryDuringWhitelistReset = ({ data }: TSocketRes<boolean>) => {
            console.log({ handleBlockEntryDuringWhitelistReset: data });
            dispatch(SET_WHITELIST_RESET_IN_PROGRESS(data));
        };
        socket.socket.on("white-list-reset-in-progress", handleBlockEntryDuringWhitelistReset);

        const handleSymbols = (data: TSocketRes<TSymbols>) => {
            console.log("symbols", data);
            const sortedSymbols = Object.values(data.data).sort((a, b) => a.symbol.localeCompare(b.symbol));
            dispatch(SET_SYMBOLS_STATE(sortedSymbols));
        };
        socket.socket?.on("symbols", handleSymbols);

        return () => {
            socket.socket?.off("setting-system", handleSettingSystem);
            socket.socket?.off("setting-user", handleSettingUser);
            socket.socket?.off("white-list-reset-in-progress", handleBlockEntryDuringWhitelistReset);
            socket.socket?.off("symbols", handleSymbols);
        };
    }, [socket?.socket]);

    return {};
};
