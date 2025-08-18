import { TSaveAccountReq, TSavePositionAccountReq } from "@/types/account.type";
import { useMutation } from "@tanstack/react-query";
import api from "../axios/app.axios";
import { TRes } from "@/types/app.type";
import { ENDPOINT } from "@/constant/endpoint.constant";
import { toast } from "sonner";
import { resError } from "@/helpers/function.helper";

export const useSaveAccount = () => {
    return useMutation({
        mutationFn: async (payload: TSaveAccountReq) => {
            const { data } = await api.post<TRes<any>>(ENDPOINT.ACCOUNT.SAVE_ACCOUNT, payload);
            // console.log({ useSaveAccount: data });
            return data;
        },
        onError: (error) => {
            console.log({ useSaveAccount: error });
            toast.error(resError(error, `Save Account Failed`));
        },
    });
};

export const useSavePositionAccount = () => {
    return useMutation({
        mutationFn: async (payload: TSavePositionAccountReq) => {
            const { data } = await api.post<TRes<any>>(ENDPOINT.ACCOUNT.SAVE_POSITION_ACCOUNT, payload);
            // console.log({ useSavePositionAccount: data });
            return data;
        },
        onError: (error) => {
            console.log({ useSavePositionAccount: error });
            toast.error(resError(error, `Save Postion Account Failed`));
        },
    });
};
