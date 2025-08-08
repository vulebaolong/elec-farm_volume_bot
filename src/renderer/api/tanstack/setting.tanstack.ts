import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { useAppDispatch } from "@/redux/store";
import { TRes } from "@/types/app.type";
import { TSetting, TSettingReq } from "@/types/setting.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";
import { SET_SETTING_BOT } from "@/redux/slices/setting.slice";

export const useGetSetting = () => {
    const dispatch = useAppDispatch();
    return useQuery({
        queryKey: ["get-setting"],
        queryFn: async () => {
            const { data } = await api.get<TRes<TSetting>>(`${ENDPOINT.SETTING.GET_SETTING}/1`);
            dispatch(SET_SETTING_BOT(data.data));
            console.log({ useGetSetting: data });
            return data.data;
        },
    });
};

export const useUpdateSetting = () => {

    return useMutation({
        mutationFn: async (payload: TSettingReq) => {
            const { data } = await api.patch<TRes<TSettingReq>>(`${ENDPOINT.SETTING.GET_SETTING}/1`, payload);
            // console.log({ useUpdateSetting: data });
            return data;
        },
        onSuccess: (data) => {
          // không cần load lại seting vì đã nhận được ở socket setting đặt ở app
            // queryClient.invalidateQueries({ queryKey: [`get-setting`] });
            toast.success(`Update Setting successfully`);
        },
        onError: (error) => {
            console.log({ useUpdateSetting: error });
            toast.error(resError(error, `Update Setting failed`));
        },
    });
};
