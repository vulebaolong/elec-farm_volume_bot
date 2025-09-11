import { ENDPOINT } from "@/constant/endpoint.constant";
import { TRes } from "@/types/app.type";
import { TBlackListRes, TCreateBlackListReq, TRemoveBlackListReq } from "@/types/black-list.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../axios/app.axios";
import { toast } from "sonner";
import { resError } from "@/helpers/function.helper";

export const useGetMyBlackList = () => {
    return useQuery({
        queryKey: ["get-my-black-list"],
        queryFn: async () => {
            const { data } = await api.get<TRes<TBlackListRes[]>>(ENDPOINT.BLACK_LIST.GET_MY_BLACK_LIST);
            window.electron?.ipcRenderer.sendMessage("bot:blackList", data.data.map((item) => item.symbol));
            console.log({ useGetMyBlackList: data });
            return data.data;
        },
    });
};

export const useCreateBlackList = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TCreateBlackListReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.BLACK_LIST.CREATE_BLACK_LIST, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-my-black-list`] });
        },
        onError: (error) => {
            console.log({ useCreateBlackList: error });
            toast.error(resError(error, `Create Black List Failed`));
        },
    });
};

export const useRemoveBlackList = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TRemoveBlackListReq) => {
            const { data } = await api.delete<TRes<boolean>>(`${ENDPOINT.BLACK_LIST.REMOVE_BLACK_LIST}/${payload.symbol}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-my-black-list`] });
        },
        onError: (error) => {
            console.log({ useRemoveBlackList: error });
            toast.error(resError(error, `Remove Black List Failed`));
        },
    });
};

export const useClearAllBlackList = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await api.delete<TRes<boolean>>(ENDPOINT.BLACK_LIST.CLEAR_ALL_BLACK_LIST);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-my-black-list`] });
        },
        onError: (error) => {
            console.log({ useClearAllBlackList: error });
            toast.error(resError(error, `Clear All Black List Failed`));
        },
    });
};
