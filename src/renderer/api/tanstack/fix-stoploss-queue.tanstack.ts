import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { TRes } from "@/types/app.type";
import { TFixStopLossQueueInDB, TUpsertFixStopLossQueueReq } from "@/types/fix-stoploss-queue.type";
import { TUser } from "@/types/user.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";
import { useAppSelector } from "@/redux/store";

export const useUpsertFixStopLossQueue = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TUpsertFixStopLossQueueReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.FIX_STOPLOSS_QUEUE.UPSERT, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-fix-stoploss-queue-by-userid`] });
        },
        onError: (error) => {
            console.log({ useUpsertFixStopLoss: error });
            toast.error(resError(error, `Upsert Stoploss Queue Failed`));
        },
    });
};

export const useGetFixStopLossQueueByUserId = () => {
    const userId = useAppSelector((state) => state.user.info?.id);

    return useQuery({
        queryKey: ["get-fix-stoploss-queue-by-userid", userId],
        queryFn: async () => {
            const { data } = await api.get<TRes<TFixStopLossQueueInDB>>(`${ENDPOINT.FIX_STOPLOSS_QUEUE.GET_ONE}`);
            console.log({ useGetFixStopLossQueueByUserId: data });
            return data.data;
        },
        enabled: !!userId,
    });
};
