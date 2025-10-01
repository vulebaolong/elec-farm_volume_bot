import { ENDPOINT } from "@/constant/endpoint.constant";
import { buildQueryString } from "@/helpers/build-query";
import { resError } from "@/helpers/function.helper";
import { TPaginationRes, TQuery, TRes } from "@/types/app.type";
import { TFixLiquidationInDB, TUpsertFixLiquidationReq } from "@/types/fix-liquidation.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";

export const useUpsertFixLiquidation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TUpsertFixLiquidationReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.FIX_LIQUIDATION.UPSERT, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-fix-liquidation`] });
        },
        onError: (error) => {
            console.log({ useUpsertLiquidation: error });
            toast.error(resError(error, `Upsert Liquidation Failed`));
        },
    });
};

export const useGetFixLiquidation = (query: TQuery) => {
    return useQuery({
        queryKey: ["get-fix-liquidation", query],
        queryFn: async () => {
            const queryString = buildQueryString(query);
            const { data } = await api.get<TRes<TPaginationRes<TFixLiquidationInDB>>>(`${ENDPOINT.FIX_LIQUIDATION.GET}?${queryString}`);
            console.log({ useGetFixLiquidation: data });
            window.electron?.ipcRenderer.sendMessage("bot:fixLiquidationInDB", data.data.items[0]);
            return data.data;
        },
    });
};
