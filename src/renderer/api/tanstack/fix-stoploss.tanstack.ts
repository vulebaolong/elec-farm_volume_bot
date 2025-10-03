import { ENDPOINT } from "@/constant/endpoint.constant";
import { buildQueryString } from "@/helpers/build-query";
import { resError } from "@/helpers/function.helper";
import { TPaginationRes, TQuery, TRes } from "@/types/app.type";
import { TFixStopLossInDB, TUpsertFixStopLossReq } from "@/types/fix-stoploss.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";

export const useUpsertFixStopLoss = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TUpsertFixStopLossReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.FIX_STOPLOSS.UPSERT, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-fix-stoploss`] });
        },
        onError: (error) => {
            console.log({ useUpsertFixStopLoss: error });
            toast.error(resError(error, `Upsert Stoploss Failed`));
        },
    });
};

export const useGetFixStopLoss = (query: TQuery) => {
    return useQuery({
        queryKey: ["get-fix-stoploss", query],
        queryFn: async () => {
            const queryString = buildQueryString(query);
            const { data } = await api.get<TRes<TPaginationRes<TFixStopLossInDB>>>(`${ENDPOINT.FIX_STOPLOSS.GET}?${queryString}`);
            console.log({ useGetFixStopLoss: data });
            return data.data;
        },
    });
};
