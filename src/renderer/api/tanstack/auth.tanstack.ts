import { ENDPOINT } from "@/constant/endpoint.constant";
import { resError } from "@/helpers/function.helper";
import { SET_INFO } from "@/redux/slices/user.slice";
import { useAppDispatch } from "@/redux/store";
import { TRes } from "@/types/app.type";
import { TLoginReq, TLoginRes, TRefreshTokenReq, TRefreshTokenRes } from "@/types/login.type";
import { TRegisterReq } from "@/types/register.type";
import { TUser } from "@/types/user.type";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { logOut, setAccessToken, setRefreshToken } from "../auth/app.auth";
import api from "../axios/app.axios";


export const useGetInfoMutation = () => {
    const dispatch = useAppDispatch();

    return useMutation({
        mutationFn: async (reasonLogout: string = "manual") => {
            const { data } = await api.get<TRes<TUser>>(`${ENDPOINT.AUTH.GET_INFO}?reasonLogout=${reasonLogout}`);

            return data;
        },
        onSuccess: (data) => {
            window.electron?.ipcRenderer.sendMessage("bot:settingUser", data.data.SettingUsers);

            dispatch(SET_INFO(data.data));

            console.log({ useGetInfoMutation: data });
        },
        onError: (error: any) => {
            console.log({ useGetInfoMutation: error });

            // Nếu 403 thì không logout (có thể đang chờ refresh)
            if (error?.response?.status === 403) return;

            // Các lỗi khác thì logout
            logOut(`3::useGetInfoMutation: ${error?.response?.data?.message}`);
        },
    });
};

export const useGetInfoQuery = () => {
    const dispatch = useAppDispatch();

    return useQuery({
        queryKey: ["query-info"],
        queryFn: async () => {
            try {
                const { data } = await api.get<TRes<TUser>>(ENDPOINT.AUTH.GET_INFO);

                dispatch(SET_INFO(data.data));

                // console.log({ useGetInfoQuery: data });

                return data;
            } catch (error: any) {
                console.log({ useGetInfoQuery: error });

                // Nếu 403 thì không logout (có thể đang chờ refresh)
                if (error?.response?.status === 403) return;

                // Các lỗi khác thì logout
                logOut(`4::useGetInfoQuery: ${error?.response?.data?.message}`);

                return null;
            }
        },
        refetchInterval: 1000,
    });
};

export const useRegister = () => {
    return useMutation({
        mutationFn: async (payload: TRegisterReq) => {
            const { data } = await api.post<TRes<TRegisterReq>>(ENDPOINT.AUTH.REGISTER, payload);
            // console.log({ useRegister: data });
            return data;
        },
        onError: (error) => {
            console.log({ useRegister: error });
            toast.error(resError(error, `Register failed`));
        },
    });
};

export const useLoginForm = () => {
    return useMutation({
        mutationFn: async (payload: TLoginReq) => {
            const { data } = await api.post<TRes<TLoginRes>>(ENDPOINT.AUTH.LOGIN, payload);
            // console.log({ useLoginForm: data });
            return data;
        },
        onError: (error) => {
            console.log({ useLoginForm: error });
            toast.error(resError(error, `Login failed`));
        },
    });
};

export const useRefreshToken = () => {
    return useMutation({
        mutationFn: async (payload: TRefreshTokenReq) => {
            const { data } = await api.post<TRes<TRefreshTokenRes>>(ENDPOINT.AUTH.REFRESH_TOKEN, payload);
            setRefreshToken(data.data.refreshToken);
            setAccessToken(data.data.accessToken);
            // console.log({ useRefreshToken: data });
            return data;
        },
        onError: (error) => {
            console.log({ useRefreshToken: error });
            toast.error(resError(error, `Login failed`));
        },
    });
};
