import api from "@/api/axios/app.axios";
import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { ENDPOINT } from "@/constant/endpoint.constant";
import { useSocket } from "@/hooks/socket.hook";
import { SET_UI_SELECTOR } from "@/redux/slices/bot.slice";
import { SET_INFO } from "@/redux/slices/user.slice";
import { useAppDispatch } from "@/redux/store";
import { TRes } from "@/types/app.type";
import { TSocketRes } from "@/types/base.type";
import { TPayload24Change } from "@/types/priority-change.type";
import { TSettingUsers } from "@/types/setting-user.type";
import { TUiSelector } from "@/types/ui-selector.type";
import { TUser } from "@/types/user.type";
import { TWhiteList } from "@/types/white-list.type";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Bot, TBotConfig } from "./class-bot";

export function useBot(webview: Electron.WebviewTag | null) {
    const botRef = useRef<Bot>(null);
    const dispatch = useAppDispatch();
    const getInfoMoutation = useGetInfoMutation();
    const socket = useSocket();
    const queryClient = useQueryClient();
    // const [whitelistUi, setWhitelistUi] = useState<TWhitelistUi[]>([]);

    // 1) Tải dữ liệu khởi tạo (chỉ chạy một lần)
    useEffect(() => {
        if (!webview || !socket?.socket) return;
        const io = socket.socket; // ✅ bắt giữ instance

        const handleSettingUser = ({ data }: TSocketRes<TSettingUsers>) => {
            getInfoMoutation.mutate();
            botRef.current?.setSettingUser(data);
        };
        const handleUiSelector = ({ data }: TSocketRes<TUiSelector[]>) => {
            dispatch(SET_UI_SELECTOR(data));
            botRef.current?.setUiSelector(data);
        };
        const handleEntry = ({ data }: TSocketRes<TWhiteList>) => {
            // console.log({ handleEntry: data });
            botRef.current?.setWhitelist(data);
        };
        const handle24hChange = ({ data }: TSocketRes<TPayload24Change>) => {
            queryClient.setQueryData<TPayload24Change>(["get-priority-24h-change"], (prev) => {
                if (!prev) return data;
                const same =
                    prev.countGreen === data.countGreen && prev.countRed === data.countRed && prev.countTotalWhiteList === data.countTotalWhiteList;
                return same ? prev : data;
            });
            botRef.current?.setPriority24hChange(data);
        };

        let cancelled = false;

        (async () => {
            try {
                // fetch song song để giảm thời gian chờ
                const [{ data: uiSelector }, { data: settingUser }, { data: priority24hChange }] = await Promise.all([
                    api.get<TRes<TUiSelector[]>>(ENDPOINT.UI_SELECTOR.GET_UI_SELECTOR),
                    api.get<TRes<TUser>>(ENDPOINT.AUTH.GET_INFO),
                    api.get<TRes<TPayload24Change>>(ENDPOINT.PRIORITY_24h_CHANGE.GET_PRIORITY_24h_CHANGE),
                ]);
                if (cancelled) return;

                dispatch(SET_UI_SELECTOR(uiSelector.data));
                dispatch(SET_INFO(settingUser.data));

                const [positions, orderOpens] = await Promise.all([Bot.getPositions(webview), Bot.getOrderOpens(webview)]);
                if (cancelled) return;

                const initConfigBot: TBotConfig = {
                    uiSelector: uiSelector.data,
                    settingUser: settingUser.data.SettingUsers,
                    priority24hChange: priority24hChange.data,
                    roleId: settingUser.data.roleId,
                };

                // ✅ không tạo mới nếu đã có
                if (botRef.current) {
                    botRef.current.update?.(initConfigBot);
                } else {
                    botRef.current = new Bot({ configBot: initConfigBot, webview, orderOpens, positions });
                    botRef.current.start();
                }

                // ✅ đăng ký trên đúng instance io
                io.off("setting-user", handleSettingUser);
                io.off("ui-selector", handleUiSelector);
                io.off("entry", handleEntry);
                io.off("24hChange", handle24hChange);

                io.on("setting-user", handleSettingUser);
                io.on("ui-selector", handleUiSelector);
                io.on("entry", handleEntry);
                io.on("24hChange", handle24hChange);
            } catch (e) {
                console.error("❌ start bot error:", e);
            }
        })();

        return () => {
            cancelled = true;
            // ✅ gỡ listeners trên đúng io
            io.off("setting-user", handleSettingUser);
            io.off("ui-selector", handleUiSelector);
            io.off("entry", handleEntry);
            io.off("24hChange", handle24hChange);
            // ✅ stop bot nếu bạn đang tạo mới theo lifecycle (tránh zombie loop)
            botRef.current?.stop?.();
        };
    }, [webview, socket?.socket]);

    return {
        botRef,
    };
}
