import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { TRes } from "@/types/app.type";
import { TDataFixStopLossHistoriesReq } from "@/types/fix-stoploss.type";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";

export const useCreateFixStopLossHistories = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TDataFixStopLossHistoriesReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.FIX_STOPLOSS_HISTORIES.CREATE, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-fix-stoploss`] });
        },
        onError: (error) => {
            console.log({ useUpsertFixStopLoss: error });
            toast.error(resError(error, `Create Stoploss Histories Failed`));
        },
    });
};
