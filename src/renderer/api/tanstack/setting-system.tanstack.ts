import { ENDPOINT } from "@/constant/endpoint.constant";
import { useAppDispatch } from "@/redux/store";
import { TRes } from "@/types/app.type";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../axios/app.axios";
import { TSettingSystem, TSettingSystemsUpdate } from "@/types/setting-system.type";
import { SET_SETTING_SYSTEM } from "@/redux/slices/bot.slice";

export const useGetSettingSystem = () => {
    const dispatch = useAppDispatch();
    return useQuery({
        queryKey: ["get-setting-system"],
        queryFn: async () => {
            const { data } = await api.get<TRes<TSettingSystem>>(`${ENDPOINT.SETTING_SYSTEM.GET_SETTING_SYSTEM}/1`);
            dispatch(SET_SETTING_SYSTEM(data.data));
            console.log({ useGetSettingSystem: data });
            return data.data;
        },
    });
};

export const useUpdateSettingSystem = () => {
    return useMutation({
        mutationFn: async (payload: TSettingSystemsUpdate) => {
            const { data } = await api.patch<TRes<TSettingSystem>>(`${ENDPOINT.SETTING_SYSTEM.GET_SETTING_SYSTEM}/1`, payload);
            // console.log({ useUpdateSetting: data });
            return data;
        },
    });
};
