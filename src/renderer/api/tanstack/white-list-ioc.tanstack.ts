import { ENDPOINT } from "@/constant/endpoint.constant";
import { buildQueryString } from "@/helpers/build-query";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { TPaginationRes, TQuery, TRes } from "@/types/app.type";
import { TCreateWhiteListIocReq, TRemoveWhiteListIocReq, TWhiteListIoc } from "@/types/white-list-ioc.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";

export const useGetWhiteListIoc = (query: TQuery) => {
    const info = useAppSelector((state) => state.user.info);

    return useQuery({
        queryKey: ["get-white-list-ioc", query, info],
        queryFn: async () => {
            const queryString = buildQueryString(query);
            const { data } = await api.get<TRes<TPaginationRes<TWhiteListIoc>>>(`${ENDPOINT.WHITE_LIST_IOC.GET}?${queryString}`);
            window.electron?.ipcRenderer.sendMessage("bot:whiteListIoc", data.data.items);
            console.log({ useGetAllWhiteListIoc: data });
            return data.data;
        },
        enabled: !!info,
    });
};

export const useCreateWhiteListIoc = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TCreateWhiteListIocReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.WHITE_LIST_IOC.CREATE, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-ioc`] });
        },
        onError: (error) => {
            console.log({ useCreateWhiteListIoc: error });
            toast.error(resError(error, `Create White List Ioc Failed`));
        },
    });
};

export const useRemoveWhiteListIoc = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TRemoveWhiteListIocReq) => {
            const { data } = await api.delete<TRes<boolean>>(`${ENDPOINT.WHITE_LIST_IOC.REMOVE}/${payload.symbol}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-ioc`] });
        },
        onError: (error) => {
            console.log({ useRemoveWhiteListIoc: error });
            toast.error(resError(error, `Remove White List Ioc Failed`));
        },
    });
};

export const useClearAllWhiteListIoc = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await api.delete<TRes<boolean>>(ENDPOINT.WHITE_LIST_IOC.CLEAR_ALL);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-ioc`] });
        },
        onError: (error) => {
            console.log({ useClearAllWhiteListIoc: error });
            toast.error(resError(error, `Clear All White List  Ioc Failed`));
        },
    });
};

export const useUpdateWhiteListIoc = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { symbol: string; size?: number; maxSize?: number }) => {
            const { data } = await api.patch<TRes<boolean>>(`${ENDPOINT.WHITE_LIST_IOC.UPDATE}/${payload.symbol}`, {
                size: payload.size,
                maxSize: payload.maxSize,
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-white-list-ioc`] });
        },
        onError: (error) => {
            console.log({ useUpdateWhiteListIoc: error });
            toast.error(resError(error, `Update Symbol White List  Ioc Failed`));
        },
    });
};

export const useResetWhiteLiseSocket = () => {
    return useMutation({
        mutationFn: async () => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.WHITE_LIST_IOC.RESET_WHITELIST_SOCKET);
            return data;
        },
        onSuccess: () => {
            toast.success("Reset White List Socket Success");
        },
        onError: (error) => {
            console.log({ useResetWhiteLiseSocket: error });
            toast.error(resError(error, `Reset White List Socket Failed`));
        },
    });
};
