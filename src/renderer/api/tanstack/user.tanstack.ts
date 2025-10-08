import { ENDPOINT } from "@/constant/endpoint.constant";
import { TPaginationRes, TQuery, TRes } from "@/types/app.type";
import { useQuery } from "@tanstack/react-query";
import api from "../axios/app.axios";
import { buildQueryString } from "@/helpers/build-query";
import { TUserManager } from "@/types/user.type";

export const useGetListUser = (query: TQuery) => {
    return useQuery({
        queryKey: ["get-list-user", query],
        queryFn: async () => {
            const queryString = buildQueryString(query);
            const { data } = await api.get<TRes<TPaginationRes<TUserManager>>>(`${ENDPOINT.USER.LIST_USER}?${queryString}`);
            console.log({ useGetListUser: data });
            return data.data;
        },
    });
};
