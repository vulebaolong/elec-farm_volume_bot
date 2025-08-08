import { ENDPOINT } from '@/constant/endpoint.constant';
import { ROUTER } from '@/constant/router.constant';
import { resError } from '@/helpers/function.helper';
import { navigateTo } from '@/helpers/navigate.helper';
import { SET_INFO } from '@/redux/slices/user.slice';
import { TRes } from '@/types/app.type';
import {
  TLoginReq,
  TLoginRes,
  TRefreshTokenReq,
  TRefreshTokenRes,
} from '@/types/login.type';
import { TRegisterReq } from '@/types/register.type';
import { TUser } from '@/types/user.type';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setAccessToken, setRefreshToken } from '../auth/app.auth';
import api from '../axios/app.axios';
import { useAppDispatch } from '@/redux/store';

export const useGetInfoMutation = () => {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.get<TRes<TUser>>(ENDPOINT.AUTH.GET_INFO);
      dispatch(SET_INFO(data.data));
      console.log({ useGetInfoMutation: data });
      return data;
    },
    onError: (error) => {
      console.log({ useGetInfoMutation: error });
    },
  });
};

export const useGetInfoQuery = () => {
  const dispatch = useAppDispatch();

  return useQuery({
    queryKey: ['query-info'],
    queryFn: async () => {
      try {
        const { data } = await api.get<TRes<TUser>>(ENDPOINT.AUTH.GET_INFO);
        dispatch(SET_INFO(data.data));
        // console.log({ useGetInfoQuery: data });
        return data;
      } catch (error) {
        navigateTo(ROUTER.LOGIN);
        console.log({ useGetInfoQuery: error });
        return null;
      }
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: async (payload: TRegisterReq) => {
      const { data } = await api.post<TRes<TRegisterReq>>(
        ENDPOINT.AUTH.REGISTER,
        payload,
      );
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
      const { data } = await api.post<TRes<TLoginRes>>(
        ENDPOINT.AUTH.LOGIN,
        payload,
      );
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
      const { data } = await api.post<TRes<TRefreshTokenRes>>(
        ENDPOINT.AUTH.REFRESH_TOKEN,
        payload,
      );
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
