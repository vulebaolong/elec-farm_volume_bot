import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { useGetUiSelector } from "@/api/tanstack/selector.tanstack";
import { SET_SETTING_SYSTEM, SET_WHITELIST_RESET_IN_PROGRESS } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { TSettingSystemsSocket } from "@/types/setting-system.type";
import { TSettingUsersSocket } from "@/types/setting-user.type";
import { TWhiteList } from "@/types/white-list.type";
import { useEffect, useRef } from "react";
import { useSocket } from "./socket.hook";

export const useInitData = () => {
    const settingUser = useAppSelector((state) => state.user.info?.SettingUsers);
    const { socket } = useSocket();
    const dispatch = useAppDispatch();
    const getUiSelector = useGetUiSelector();
    const countRef = useRef(0);
    const getInfoMutation = useGetInfoMutation();

    useEffect(() => {
        if (!socket) return;

        // cập nhật setting system
        const handleSettingSystem = ({ data }: TSocketRes<TSettingSystemsSocket>) => {
            console.log({ handleSettingSystem: data });
            dispatch(SET_SETTING_SYSTEM(data));
        };
        socket.on("setting-system", handleSettingSystem);

        // cập nhật setting user thường
        const handleSettingUser = ({ data }: TSocketRes<TSettingUsersSocket>) => {
            getInfoMutation.mutate();
        };
        socket.on("setting-user", handleSettingUser);

        // tránh vào lệnh trong khi đang reset whitelist
        const handleBlockEntryDuringWhitelistReset = ({ data }: TSocketRes<boolean>) => {
            console.log({ handleBlockEntryDuringWhitelistReset: data });
            dispatch(SET_WHITELIST_RESET_IN_PROGRESS(data));
        };
        socket.on("white-list-reset-in-progress", handleBlockEntryDuringWhitelistReset);

        const handleEntry = ({ data }: TSocketRes<TWhiteList>) => {
            // console.log({ handleEntry: data });
            window.electron?.ipcRenderer.sendMessage("bot:setWhiteList", data);
        };
        socket.on("entry", handleEntry);

        return () => {
            socket.off("setting-system", handleSettingSystem);
            socket.off("white-list-reset-in-progress", handleBlockEntryDuringWhitelistReset);
            socket.off("setting-user", handleSettingUser);
            socket.off("entry", handleEntry);
        };
    }, [socket]);

    useEffect(() => {
        if (!settingUser || !getUiSelector.data) return;

        if (countRef.current === 0) {
            const dataWorkerInit = {
                settingUser: settingUser,
                uiSelector: getUiSelector.data,
            };
            window.electron?.ipcRenderer.sendMessage("bot:init", dataWorkerInit);
            countRef.current = 1;
        } else {
            console.log("settingUser: ", settingUser);
            window.electron?.ipcRenderer.sendMessage("bot:settingUser", settingUser);
            window.electron?.ipcRenderer.sendMessage("bot:uiSelector", getUiSelector.data);
        }
    }, [settingUser, getUiSelector.data]);

    return {};
};
