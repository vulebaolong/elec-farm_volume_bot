import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { TRes } from "@/types/app.type";
import { TCreateWhiteListMartingaleReq, TRemoveWhiteListMartingaleReq, TWhiteListMartingale } from "@/types/white-list-martingale.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";
import { useAppSelector } from "@/redux/store";

export const useGetAllWhiteListMartingale = () => {
    const info = useAppSelector((state) => state.user.info);

    return useQuery({
        queryKey: ["get-all-white-list-martingale", info],
        queryFn: async () => {
            const { data } = await api.get<TRes<TWhiteListMartingale[]>>(ENDPOINT.WHITE_LIST_MARTINGALE.GET_ALL_WHITE_LIST_MARTINGALE);
            window.electron?.ipcRenderer.sendMessage(
                "bot:whiteListMartingale",
                data.data.map((item) => item.symbol),
            );
            console.log({ useGetAllWhiteListMartingale: data });
            return data.data;
        },
    });
};

export const useCreateWhiteListMartingale = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TCreateWhiteListMartingaleReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.WHITE_LIST_MARTINGALE.CREATE_WHITE_LIST_MARTINGALE, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-all-white-list-martingale`] });
        },
        onError: (error) => {
            console.log({ useCreateWhiteListMartingale: error });
            toast.error(resError(error, `Create White List Martingale Failed`));
        },
    });
};

export const useRemoveWhiteListMartingale = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TRemoveWhiteListMartingaleReq) => {
            const { data } = await api.delete<TRes<boolean>>(`${ENDPOINT.WHITE_LIST_MARTINGALE.REMOVE_WHITE_LIST_MARTINGALE}/${payload.symbol}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-all-white-list-martingale`] });
        },
        onError: (error) => {
            console.log({ useRemoveWhiteListMartingale: error });
            toast.error(resError(error, `Remove White List Martingale Failed`));
        },
    });
};

export const useClearAllWhiteListMartingale = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await api.delete<TRes<boolean>>(ENDPOINT.WHITE_LIST_MARTINGALE.CLEAR_ALL_WHITE_LIST_MARTINGALE);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-all-white-list-martingale`] });
        },
        onError: (error) => {
            console.log({ useClearAllWhiteListMartingale: error });
            toast.error(resError(error, `Clear All White List Martingale Failed`));
        },
    });
};
