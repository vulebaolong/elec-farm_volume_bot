import { useQuery } from "@tanstack/react-query";
import api from "../axios/app.axios";
import { TRes } from "@/types/app.type";
import { TWhiteListSocketRes } from "@/types/white-list.type";
import { ENDPOINT } from "@/constant/endpoint.constant";

export const useGetWhiteList = () => {
    return useQuery({
        queryKey: ["get-white-list"],
        queryFn: async () => {
            const { data } = await api.get<TRes<TWhiteListSocketRes>>(`${ENDPOINT.WHITE_LIST.GET_WHITE_LIST}`);
            console.log({ useGetWhiteList: data });
            return data.data;
        },
    });
};
