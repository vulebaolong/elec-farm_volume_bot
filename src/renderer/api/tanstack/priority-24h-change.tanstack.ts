import { ENDPOINT } from "@/constant/endpoint.constant";
import { TRes } from "@/types/app.type";
import { TPayload24Change } from "@/types/priority-change.type";
import { useQuery } from "@tanstack/react-query";
import api from "../axios/app.axios";

export const useGetPriority24Change = () => {
    return useQuery({
        queryKey: ["get-priority-24h-change"],
        queryFn: async () => {
            const { data } = await api.get<TRes<TPayload24Change>>(ENDPOINT.PRIORITY_24h_CHANGE.GET_PRIORITY_24h_CHANGE);
            console.log({ useGetPriority24Change: data });
            return data.data;
        },
    });
};
