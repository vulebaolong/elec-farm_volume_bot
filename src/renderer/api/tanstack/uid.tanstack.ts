import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { TRes } from "@/types/app.type";
import { TUidCreate, TUidDelete, TUidUpdate } from "@/types/uid.type";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";


export const useCreateUid = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TUidCreate) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.UID.CREATE, payload);
            console.log({ useCreateUid: data });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-list-user`] });
        },
        onError: (error) => {
            console.log({ useCreateUid: error });
            toast.error(resError(error, `Create UID Failed`));
        },
    });
};

export const useUpdateUid = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TUidUpdate) => {
            const { data } = await api.patch<TRes<boolean>>(`${ENDPOINT.UID.UPDATE}/${payload.id}`, payload);
            console.log({ useUpdateUid: data });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-list-user`] });
        },
        onError: (error) => {
            console.log({ useUpdateUid: error });
            toast.error(resError(error, `Update UID Failed`));
        },
    });
};

export const useDeleteUid = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: TUidDelete) => {
            const { data } = await api.delete<TRes<boolean>>(`${ENDPOINT.UID.DELETE}/${payload.id}`);
            console.log({ useDeleteUid: data });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-list-user`] });
        },
        onError: (error) => {
            console.log({ useDeleteUid: error });
            toast.error(resError(error, `Delete UID Failed`));
        },
    });
};
