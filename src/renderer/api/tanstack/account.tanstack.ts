import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { TUpsertAccountReq } from "@/types/account.type";
import { TRes } from "@/types/app.type";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";

export const useUpsertAccount = () => {
    return useMutation({
        mutationFn: async (payload: TUpsertAccountReq) => {
            const { data } = await api.post<TRes<boolean>>(ENDPOINT.ACCOUNT.UPSERT, payload);
            // console.log({ useUpsertAccount: data });
            return data;
        },
        onError: (error) => {
            console.log({ useUpsertAccount: error });
            toast.error(resError(error, `Upsert Account Failed`));
        },
    });
};
