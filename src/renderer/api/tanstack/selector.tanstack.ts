import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../axios/app.axios";
import { TRes } from "@/types/app.type";
import { ENDPOINT } from "@/constant/endpoint.constant";
import { TUiSelector } from "@/types/ui-selector.type";
import { TFormValuesUiSelector } from "@/components/setting-dev/setting-selector";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { SET_UI_SELECTOR } from "@/redux/slices/bot.slice";

export const useGetUiSelector = () => {
    const dispatch = useAppDispatch();
    const info = useAppSelector((state) => state.user.info);

    return useQuery({
        queryKey: ["get-ui-selector", info],
        queryFn: async () => {
            const { data } = await api.get<TRes<TUiSelector[]>>(ENDPOINT.UI_SELECTOR.GET_UI_SELECTOR);

            console.log({ useGetUiSelector: data });

            window.electron?.ipcRenderer.sendMessage("bot:uiSelector", data.data);

            dispatch(SET_UI_SELECTOR(data.data));

            return data.data;
        },
    });
};

export const useUpsertUiSelector = () => {
    return useMutation({
        mutationFn: async (payload: TFormValuesUiSelector) => {
            const { data } = await api.patch<TRes<boolean>>(ENDPOINT.UI_SELECTOR.UPSERT_UI_SELECTOR, payload);
            console.log({ useUpsertUiSelector: data });
            return data;
        },
    });
};
