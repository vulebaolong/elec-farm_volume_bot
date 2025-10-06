import { ENDPOINT } from "@/constant/endpoint.constant";
import { TRes } from "@/types/app.type";
import { TUpsertFixStopLossQueueReq } from "@/types/fix-stoploss-queue.type";
import { useMutation } from "@tanstack/react-query";
import api from "../axios/app.axios";
import { toast } from "sonner";
import { resError } from "@/helpers/function.helper";

export const useUpsertFixStopLossQueue = () => {
    return useMutation({
        mutationFn: async (payload: TUpsertFixStopLossQueueReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.FIX_STOPLOSS_QUEUE.UPSERT, payload);
            return data;
        },

        onError: (error) => {
            console.log({ useUpsertFixStopLoss: error });
            toast.error(resError(error, `Upsert Stoploss Queue Failed`));
        },
    });
};
