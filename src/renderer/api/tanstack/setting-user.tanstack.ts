import { ENDPOINT } from "@/constant/endpoint.constant";
import { TRes } from "@/types/app.type";
import { TSettingUsers, TSettingUsersUpdate } from "@/types/setting-user.type";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../axios/app.axios";

export const useUpdateSettingUser = () => {
    return useMutation({
        mutationFn: async (payload: TSettingUsersUpdate) => {
            const { data } = await api.patch<TRes<TSettingUsers>>(`${ENDPOINT.SETTING_USER.UPDATE_SETTING_USER}/${payload.id}`, payload);
            console.log({ useUpdateSettingUser: data });
            return data;
        },
    });
};

export const useGetSettingUserById = (settingUserId: number) => {
    return useQuery({
        queryKey: ["get-setting-user-by-id", settingUserId],
        queryFn: async () => {
            const { data } = await api.get<TRes<TSettingUsers>>(`${ENDPOINT.SETTING_USER.UPDATE_SETTING_USER}/${settingUserId}`);
            return data.data;
        },
    });
};
