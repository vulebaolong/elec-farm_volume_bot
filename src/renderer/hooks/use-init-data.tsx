import { SET_SETTING_BOT } from "@/redux/slices/setting.slice";
import { useAppDispatch } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { TSetting } from "@/types/setting.type";
import { useEffect } from "react";
import { useSocket } from "./socket.hook";

export const useInitData = () => {
    const socket = useSocket();
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (!socket?.socket) return;

        const handleSetting = ({ data }: TSocketRes<TSetting[]>) => {
            console.log({ handleSetting: data });
            dispatch(SET_SETTING_BOT(data));
        };

        socket.socket.on("setting", handleSetting);

        return () => {
            socket.socket?.off("setting", handleSetting);
        };
    }, [socket?.socket]);

    return {};
};
