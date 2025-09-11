import { ENDPOINT } from "@/constant/endpoint.constant";
import { TRes } from "@/types/app.type";
import { useQuery } from "@tanstack/react-query";
import api from "../axios/app.axios";
import { TContractSymbolRes } from "@/types/contract.type";

export const useGetContractSymbol = () => {
    return useQuery({
        queryKey: ["get-contract-symbol"],
        queryFn: async () => {
            const { data } = await api.get<TRes<TContractSymbolRes[]>>(ENDPOINT.CONTRACT.GET_CONTRACT_SYMBOL);
            console.log({ useGetContractSymbol: data });
            return data.data;
        },
    });
};
