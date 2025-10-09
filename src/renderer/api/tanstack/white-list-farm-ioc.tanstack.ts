import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { TRes } from "@/types/app.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";
import { useAppSelector } from "@/redux/store";
import { TCreateWhiteListFarmIocReq, TRemoveWhiteListFarmIocReq, TWhiteListFarmIoc } from "@/types/white-list-farm-ioc.type";

export const useGetAllWhiteListFarmIoc = () => {
    const info = useAppSelector((state) => state.user.info);

    return useQuery({
        queryKey: ["get-all-white-list-farm-ioc", info],
        queryFn: async () => {
            const { data } = await api.get<TRes<TWhiteListFarmIoc[]>>(ENDPOINT.WHITE_LIST_FARM_IOC.GET_ALL_WHITE_LIST_FARM_IOC);
            window.electron?.ipcRenderer.sendMessage(
                "bot:whiteListFarmIoc",
                data.data.map((item) => item.symbol),
            );
            console.log({ useGetAllWhiteListFarmIoc: data });
            return data.data;
        },
    });
};

export const useCreateWhiteListFarmIoc = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TCreateWhiteListFarmIocReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.WHITE_LIST_FARM_IOC.CREATE_WHITE_LIST_FARM_IOC, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-all-white-list-farm-ioc`] });
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
            const { data } = await api.delete<TRes<boolean>>(`${ENDPOINT.WHITE_LIST_FARM_IOC.REMOVE_WHITE_LIST_FARM_IOC}/${payload.symbol}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-all-white-list-farm-ioc`] });
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
            const { data } = await api.delete<TRes<boolean>>(ENDPOINT.WHITE_LIST_FARM_IOC.CLEAR_ALL_WHITE_LIST_FARM_IOC);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-all-white-list-farm-ioc`] });
        },
        onError: (error) => {
            console.log({ useClearAllWhiteListFarmIoc: error });
            toast.error(resError(error, `Clear All White List Farm Ioc Failed`));
        },
    });
};
