import { ENDPOINT } from "@/constant/endpoint.constant";
import { buildQueryString } from "@/helpers/build-query";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { TPaginationRes, TQuery, TRes } from "@/types/app.type";
import { TCreateWhiteListScalpIocReq, TRemoveWhiteListScalpIocReq, TWhiteListScalpIoc } from "@/types/white-list-scalp-ioc.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";

export const useGetWhiteListScalpIoc = (query: TQuery) => {
    const info = useAppSelector((state) => state.user.info);

    return useQuery({
        queryKey: ["get-white-list-scalp-ioc", query, info],
        queryFn: async () => {
            const queryString = buildQueryString(query);
            const { data } = await api.get<TRes<TPaginationRes<TWhiteListScalpIoc>>>(`${ENDPOINT.WHITE_LIST_SCALP_IOC.GET}?${queryString}`);
            window.electron?.ipcRenderer.sendMessage("bot:whiteListScalpIoc", data.data.items);
            console.log({ useGetAllWhiteListScalpIoc: data });
            return data.data;
        },
        enabled: !!info,
    });
};

export const useCreateWhiteListScalpIoc = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TCreateWhiteListScalpIocReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.WHITE_LIST_SCALP_IOC.CREATE, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-scalp-ioc`] });
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
            const { data } = await api.delete<TRes<boolean>>(`${ENDPOINT.WHITE_LIST_SCALP_IOC.REMOVE}/${payload.symbol}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-scalp-ioc`] });
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
            const { data } = await api.delete<TRes<boolean>>(ENDPOINT.WHITE_LIST_SCALP_IOC.CLEAR_ALL);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-scalp-ioc`] });
        },
        onError: (error) => {
            console.log({ useClearAllWhiteListScalpIoc: error });
            toast.error(resError(error, `Clear All White List Scalp Ioc Failed`));
        },
    });
};

export const useUpdateWhiteListScalpIoc = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { symbol: string; size?: number; maxSize?: number }) => {
            const { data } = await api.patch<TRes<boolean>>(`${ENDPOINT.WHITE_LIST_SCALP_IOC.UPDATE}/${payload.symbol}`, {
                size: payload.size,
                maxSize: payload.maxSize,
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-scalp-ioc`] });
        },
        onError: (error) => {
            console.log({ useUpdateWhiteListScalpIoc: error });
            toast.error(resError(error, `Update Symbol White List Scalp Ioc Failed`));
        },
    });
};
