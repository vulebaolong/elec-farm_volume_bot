import { ENDPOINT } from "@/constant/endpoint.constant";
import { buildQueryString } from "@/helpers/build-query";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { TPaginationRes, TQuery, TRes } from "@/types/app.type";
import { TCreateWhiteListFarmIocReq, TRemoveWhiteListFarmIocReq, TWhiteListFarmIoc } from "@/types/white-list-farm-ioc.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";

export const useGetWhiteListFarmIoc = (query: TQuery) => {
    const info = useAppSelector((state) => state.user.info);

    return useQuery({
        queryKey: ["get-white-list-farm-ioc", query, info],
        queryFn: async () => {
            const queryString = buildQueryString(query);
            const { data } = await api.get<TRes<TPaginationRes<TWhiteListFarmIoc>>>(`${ENDPOINT.WHITE_LIST_FARM_IOC.GET}?${queryString}`);
            window.electron?.ipcRenderer.sendMessage("bot:whiteListFarmIoc", data.data.items);
            console.log({ useGetAllWhiteListFarmIoc: data });
            return data.data;
        },
        enabled: !!info,
    });
};

export const useCreateWhiteListFarmIoc = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TCreateWhiteListFarmIocReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.WHITE_LIST_FARM_IOC.CREATE, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-farm-ioc`] });
        },
        onError: (error) => {
            console.log({ useCreateWhiteListFarmIoc: error });
            toast.error(resError(error, `Create White List Farm Ioc Failed`));
        },
    });
};

export const useRemoveWhiteListFarmIoc = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TRemoveWhiteListFarmIocReq) => {
            const { data } = await api.delete<TRes<boolean>>(`${ENDPOINT.WHITE_LIST_FARM_IOC.REMOVE}/${payload.symbol}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-farm-ioc`] });
        },
        onError: (error) => {
            console.log({ useRemoveWhiteListFarmIoc: error });
            toast.error(resError(error, `Remove White List FarmIoc Failed`));
        },
    });
};

export const useClearAllWhiteListFarmIoc = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await api.delete<TRes<boolean>>(ENDPOINT.WHITE_LIST_FARM_IOC.CLEAR_ALL);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-farm-ioc`] });
        },
        onError: (error) => {
            console.log({ useClearAllWhiteListFarmIoc: error });
            toast.error(resError(error, `Clear All White List Farm Ioc Failed`));
        },
    });
};

export const useUpdateWhiteListFarmIoc = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { symbol: string; size?: number; maxSize?: number }) => {
            const { data } = await api.patch<TRes<boolean>>(`${ENDPOINT.WHITE_LIST_FARM_IOC.UPDATE}/${payload.symbol}`, {
                size: payload.size,
                maxSize: payload.maxSize,
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-farm-ioc`] });
        },
        onError: (error) => {
            console.log({ useUpdateWhiteListFarmIoc: error });
            toast.error(resError(error, `Update Symbol White List Farm Ioc Failed`));
        },
    });
};
