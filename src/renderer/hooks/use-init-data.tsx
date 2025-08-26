import { useGetUiSelector } from "@/api/tanstack/selector.tanstack";
import { SET_SETTING_SYSTEM, SET_WHITELIST_RESET_IN_PROGRESS } from "@/redux/slices/bot.slice";
import { useAppDispatch } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { TSettingSystemsSocket } from "@/types/setting-system.type";
import { useEffect } from "react";
import { useSocket } from "./socket.hook";

export const useInitData = () => {
    const socket = useSocket();
    const dispatch = useAppDispatch();
    useGetUiSelector();

    useEffect(() => {
        if (!socket?.socket) return;

        // cập nhật setting system
        const handleSettingSystem = ({ data }: TSocketRes<TSettingSystemsSocket>) => {
            console.log({ handleSettingSystem: data });
            dispatch(SET_SETTING_SYSTEM(data));
        };
        socket.socket.on("setting-system", handleSettingSystem);

        // tránh vào lệnh trong khi đang reset whitelist
        const handleBlockEntryDuringWhitelistReset = ({ data }: TSocketRes<boolean>) => {
            console.log({ handleBlockEntryDuringWhitelistReset: data });
            dispatch(SET_WHITELIST_RESET_IN_PROGRESS(data));
        };
        socket.socket.on("white-list-reset-in-progress", handleBlockEntryDuringWhitelistReset);

        return () => {
            socket.socket?.off("setting-system", handleSettingSystem);
            socket.socket?.off("white-list-reset-in-progress", handleBlockEntryDuringWhitelistReset);
        };
    }, [socket?.socket]);

    return {};
};
