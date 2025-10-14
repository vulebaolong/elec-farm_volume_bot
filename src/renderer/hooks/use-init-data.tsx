import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { useGetMyBlackList } from "@/api/tanstack/black-list.tanstack";
import { useGetFixLiquidation } from "@/api/tanstack/fix-liquidation.tanstack";
import { useGetFixStopLossQueueByUserId } from "@/api/tanstack/fix-stoploss-queue.tanstack";
import { useGetFixStopLoss } from "@/api/tanstack/fix-stoploss.tanstack";
import { useGetUiSelector } from "@/api/tanstack/selector.tanstack";
import { useSocketEmit } from "@/api/tanstack/socket.tanstack";
import { useGetAllWhiteListMartingale } from "@/api/tanstack/white-list-martingale.tanstack";
import { SOCKET_ENVENT } from "@/constant/socket.constant";
import { SET_SETTING_SYSTEM, SET_WHITELIST_DETAIL, SET_WHITELIST_RESET_IN_PROGRESS } from "@/redux/slices/bot.slice";
import { SET_IS_INIT_WORKER } from "@/redux/slices/user.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { TDataInitBot } from "@/types/bot.type";
import { TSettingSystemsSocket } from "@/types/setting-system.type";
import { TSettingUsersSocket } from "@/types/setting-user.type";
import { TWhiteList } from "@/types/white-list.type";
import { useEffect } from "react";
import { useSocket } from "./socket.hook";
import { useGetWhiteListFarmIoc } from "@/api/tanstack/white-list-farm-ioc.tanstack";
import { useGetWhiteListScalpIoc } from "@/api/tanstack/white-list-scalp-ioc.tanstack";

export const useInitData = () => {
    const settingUser = useAppSelector((state) => state.user.info?.SettingUsers);
    const uids = useAppSelector((state) => state.user.info?.Uids);
    const info = useAppSelector((state) => state.user.info);
    const isInitWorker = useAppSelector((state) => state.user.isInitWorker);
    const { socket } = useSocket();
    const dispatch = useAppDispatch();
    const getUiSelector = useGetUiSelector();
    const getInfoMutation = useGetInfoMutation();
    const getMyBlackList = useGetMyBlackList();
    const getAllWhiteListMartingale = useGetAllWhiteListMartingale();

    const getWhiteListFarmIoc = useGetWhiteListFarmIoc({
        pagination: { page: 1, pageSize: 99999 },
        filters: {},
        sort: { sortBy: `createdAt`, isDesc: true },
    });
    const getWhiteListScalpIoc = useGetWhiteListScalpIoc({
        pagination: { page: 1, pageSize: 99999 },
        filters: {},
        sort: { sortBy: `createdAt`, isDesc: true },
    });

    const getFixLiquidation = useGetFixLiquidation({
        pagination: { page: 1, pageSize: 10 },
        filters: {},
        sort: { sortBy: `createdAt`, isDesc: true },
    });
    const getFixStopLoss = useGetFixStopLoss({
        pagination: { page: 1, pageSize: 10 },
        filters: {},
        sort: { sortBy: `createdAt`, isDesc: true },
    });
    const getFixStopLossQueueByUserId = useGetFixStopLossQueueByUserId();

    const joinRoomEntry = useSocketEmit<boolean>({
        socket,
        event: SOCKET_ENVENT.JOIN_ROOM_ENTRY,
        timeoutMs: 10000,
    });

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
            getInfoMutation.mutate(`update setting user`);
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
            dispatch(SET_WHITELIST_DETAIL(data));
        };
        socket.on("entry", handleEntry);

        const handleCheckLogin = ({ data }: TSocketRes<TWhiteList>) => {
            console.log({ handleCheckLogin: data });
            getInfoMutation.mutate(`check login`);
        };
        socket.on("check-login", handleCheckLogin);

        return () => {
            socket.off("setting-system", handleSettingSystem);
            socket.off("white-list-reset-in-progress", handleBlockEntryDuringWhitelistReset);
            socket.off("setting-user", handleSettingUser);
            socket.off("entry", handleEntry);
            socket.off("check-login", handleCheckLogin);
        };
    }, [socket]);

    useEffect(() => {
        // console.log(456, {
        //     settingUser,
        //     getUiSelector: getUiSelector.data,
        //     getMyBlackList: getMyBlackList.data,
        //     getAllWhiteListMartingale: getAllWhiteListMartingale.data,
        //     getWhiteListFarmIoc: getWhiteListFarmIoc.data,
        //     getWhiteListScalpIoc: getWhiteListScalpIoc.data,
        //     getFixLiquidation: getFixLiquidation.data,
        //     getFixStopLoss: getFixStopLoss.data,
        //     getFixStopLossQueueByUserId: getFixStopLossQueueByUserId.data,
        //     uids: uids,
        //     isInitWorker: isInitWorker,
        // });
        if (!settingUser) return;
        if (!getUiSelector.data) return;
        if (!getMyBlackList.data) return;
        if (!getAllWhiteListMartingale.data) return;
        if (!getWhiteListFarmIoc.data) return;
        if (!getWhiteListScalpIoc.data) return;
        if (!getFixLiquidation.data) return;
        if (!getFixStopLoss.data) return;
        if (!getFixStopLossQueueByUserId.data) return;
        if (!uids) return;
        if (!isInitWorker) return;

        const dataWorkerInit: Omit<TDataInitBot, "parentPort" | "uidDB"> = {
            settingUser: settingUser,
            uiSelector: getUiSelector.data,
            blackList: getMyBlackList.data.map((item) => item.symbol),
            whiteListMartingale: getAllWhiteListMartingale.data.map((item) => item.symbol),
            whiteListFarmIoc: getWhiteListFarmIoc.data.items,
            whiteListScalpIoc: getWhiteListScalpIoc.data.items,
            fixLiquidationInDB: getFixLiquidation.data.items?.[0],
            fixStopLossInDB: getFixStopLoss.data.items?.[0],
            fixStopLossQueueInDB: getFixStopLossQueueByUserId.data,
            uids: uids,
        };
        window.electron?.ipcRenderer.sendMessage("worker:initMany", dataWorkerInit);
        dispatch(SET_IS_INIT_WORKER(false));
    }, [
        settingUser,
        getUiSelector.data,
        getMyBlackList.data,
        getAllWhiteListMartingale.data,
        getWhiteListFarmIoc.data,
        getWhiteListScalpIoc.data,
        getFixLiquidation.data,
        getFixStopLoss.data,
        getFixStopLossQueueByUserId.data,
        isInitWorker,
    ]);

    useEffect(() => {
        if (info && socket) {
            joinRoomEntry.mutate(
                {},
                {
                    onSuccess: (data) => {
                        console.log({ joinRoomEntry: data });
                    },
                },
            );
        }
    }, [info, socket]);

    return {};
};
