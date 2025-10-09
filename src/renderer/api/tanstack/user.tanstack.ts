import { ENDPOINT } from "@/constant/endpoint.constant";
import { TPaginationRes, TQuery, TRes } from "@/types/app.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../axios/app.axios";
import { buildQueryString } from "@/helpers/build-query";
import { TLoginTrueOrFalseReq, TUserManager } from "@/types/user.type";
import { toast } from "sonner";
import { resError } from "@/helpers/function.helper";

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

export const useLoginTrue = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TLoginTrueOrFalseReq) => {
            const { data } = await api.post<TRes<boolean>>(`${ENDPOINT.USER.LOGIN_TRUE}/${payload.userId}`);
            console.log({ useLoginTrue: data });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-list-user`] });
        },
        onError: (error) => {
            console.log({ useLoginTrue: error });
            toast.error(resError(error, `Login Allow failed`));
        },
    });
};

export const useLoginFalse = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TLoginTrueOrFalseReq) => {
            const { data } = await api.post<TRes<boolean>>(`${ENDPOINT.USER.LOGIN_FALSE}/${payload.userId}`);
            console.log({ useLoginFalse: data });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-list-user`] });
        },
        onError: (error) => {
            console.log({ useLoginTrue: error });
            toast.error(resError(error, `Login Allow failed`));
        },
    });
};
