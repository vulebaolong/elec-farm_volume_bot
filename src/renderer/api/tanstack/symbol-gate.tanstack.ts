import { ENDPOINT } from "@/constant/endpoint.constant";
import { buildQueryString } from "@/helpers/build-query";
import { TPaginationRes, TQuery, TRes } from "@/types/app.type";
import { TSymbolGate } from "@/types/symbol-gate.type";
import { useQuery } from "@tanstack/react-query";
import api from "../axios/app.axios";

export const useGetSymbolGate = (query: TQuery) => {
    return useQuery({
        queryKey: ["get-symbol-gate", query],
        queryFn: async () => {
            const queryString = buildQueryString(query);
            const { data } = await api.get<TRes<TPaginationRes<TSymbolGate>>>(`${ENDPOINT.SYMBOL_GATE.GET}?${queryString}`);
            console.log({ useGetSymbolGate: data });
            return data.data;
        },
    });
};
