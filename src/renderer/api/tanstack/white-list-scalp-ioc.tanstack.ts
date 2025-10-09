import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { TRes } from "@/types/app.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";
import { useAppSelector } from "@/redux/store";
import { TCreateWhiteListScalpIocReq, TRemoveWhiteListScalpIocReq, TWhiteListScalpIoc } from "@/types/white-list-scalp-ioc.type";

export const useGetAllWhiteListScalpIoc = () => {
    const info = useAppSelector((state) => state.user.info);

    return useQuery({
        queryKey: ["get-all-white-list-scalp-ioc", info],
        queryFn: async () => {
            const { data } = await api.get<TRes<TWhiteListScalpIoc[]>>(ENDPOINT.WHITE_LIST_SCALP_IOC.GET_ALL_WHITE_LIST_SCALP_IOC);
            window.electron?.ipcRenderer.sendMessage(
                "bot:whiteListScalpIoc",
                data.data.map((item) => item.symbol),
            );
            console.log({ useGetAllWhiteListScalpIoc: data });
            return data.data;
        },
    });
};

export const useCreateWhiteListScalpIoc = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TCreateWhiteListScalpIocReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.WHITE_LIST_SCALP_IOC.CREATE_WHITE_LIST_SCALP_IOC, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-all-white-list-scalp-ioc`] });
        },
        onError: (error) => {
            console.log({ useCreateWhiteListScalpIoc: error });
            toast.error(resError(error, `Create White List Scalp Ioc Failed`));
        },
    });
};

export const useRemoveWhiteListScalpIoc = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TRemoveWhiteListScalpIocReq) => {
            const { data } = await api.delete<TRes<boolean>>(`${ENDPOINT.WHITE_LIST_SCALP_IOC.REMOVE_WHITE_LIST_SCALP_IOC}/${payload.symbol}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-all-white-list-scalp-ioc`] });
        },
        onError: (error) => {
            console.log({ useRemoveWhiteListScalpIoc: error });
            toast.error(resError(error, `Remove White List ScalpIoc Failed`));
        },
    });
};

export const useClearAllWhiteListScalpIoc = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await api.delete<TRes<boolean>>(ENDPOINT.WHITE_LIST_SCALP_IOC.CLEAR_ALL_WHITE_LIST_SCALP_IOC);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-all-white-list-scalp-ioc`] });
        },
        onError: (error) => {
            console.log({ useClearAllWhiteListScalpIoc: error });
            toast.error(resError(error, `Clear All White List Scalp Ioc Failed`));
        },
    });
};
