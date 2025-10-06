import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { TPaginationRes, TQuery, TRes } from "@/types/app.type";
import { TCreateTakeprofitAccountReq, TTakeprofitAccount, TUpdateTakeprofitAccountReq } from "@/types/takeprofit-account.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../axios/app.axios";

export const useGetTakeProfitAccount = (payload: TQuery) => {
    return useQuery({
        queryKey: [`get-takeprofit-account`, payload],
        queryFn: async () => {
            const { pagination, filters, sort } = payload;
            const { page, pageSize } = pagination;
            const query = `page=${page}&pageSize=${pageSize}&filters=${JSON.stringify(filters)}&sortBy=${sort?.sortBy}&isDesc=${sort?.isDesc}`;

            const { data } = await api.get<TRes<TPaginationRes<TTakeprofitAccount>>>(`${ENDPOINT.TAKEPROFIT_ACCOUNT.GET}?${query}`);

            window.electron?.ipcRenderer.sendMessage("bot:takeProfitAccount", data.data.items[0]);

            // console.log({ useGetTakeProfitAccount: data });

            // await wait(100000);

            return data.data;
        },
    });
};

export const useCreateTakeProfitAccount = () => {
    return useMutation({
        mutationFn: async (payload: TCreateTakeprofitAccountReq) => {
            const { data } = await api.post<TRes<TTakeprofitAccount>>(ENDPOINT.TAKEPROFIT_ACCOUNT.CREATE, payload);
            return data;
        },
        onError: (error) => {
            console.log({ useCreateTakeProfitAccount: error });
            toast.error(resError(error, `Create Takeprofit Account Failed`));
        },
    });
};

export const useUpdateTakeProfitAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TUpdateTakeprofitAccountReq) => {
            const { data } = await api.patch<TRes<boolean>>(`${ENDPOINT.TAKEPROFIT_ACCOUNT.UPDATE}/${payload.id}`, payload.data);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`get-takeprofit-account`] });
        },
        onError: (error) => {
            console.log({ useCreateTakeProfitAccount: error });
            toast.error(resError(error, `Update Takeprofit Account Failed`));
        },
    });
};
