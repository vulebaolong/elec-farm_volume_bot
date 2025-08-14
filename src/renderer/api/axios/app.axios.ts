import axios from "axios";
import { getAccessToken, getRefreshToken, logOut, setAccessToken, setRefreshToken } from "../auth/app.auth";

import { BASE_URL } from "@/constant/app.constant";
import { ENDPOINT } from "@/constant/endpoint.constant";
import { TRes } from "@/types/app.type";
import { TLoginRes } from "@/types/login.type";

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        "Content-Type": "application/json",
        "Accept-Language": "en-US,en;q=0.5",
    },
});

api.interceptors.request.use(
    function (config) {
        const token = getAccessToken();

        if (token) config.headers.Authorization = `bearer ${token}`;

        return config;
    },
    function (error) {
        return Promise.reject(error);
    },
);

const refreshTokenInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
        "Content-Type": "application/json",
        "Accept-Language": "en-US,en;q=0.5",
    },
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        // const authorizationHeader = originalRequest?.headers?.Authorization || originalRequest?.headers?.authorization || null;

        if (error.response?.status === 401) {
            console.log(`401 => logout`);
            logOut();
        }

        if (error.response?.status === 403 && !originalRequest._retry) {
            console.log(`403 => Refreshing`);

            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers["Authorization"] = "Bearer " + token;
                        return axios(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = getRefreshToken();
            const accessToken = getAccessToken();

            return new Promise(function (resolve, reject) {
                refreshTokenInstance
                    .post(`${ENDPOINT.AUTH.REFRESH_TOKEN}`, {
                        refreshToken,
                        accessToken,
                    })
                    .then(async ({ data }: { data: TRes<TLoginRes> }) => {
                        setRefreshToken(data.data.refreshToken);
                        setAccessToken(data.data.accessToken);

                        processQueue(null, data.data.accessToken);
                        originalRequest.headers["Authorization"] = "Bearer " + data.data.accessToken;
                        resolve(axios(originalRequest));
                    })
                    .catch((err) => {
                        processQueue(err, null);
                        logOut();
                        reject(err);
                    })
                    .finally(() => {
                        isRefreshing = false;
                    });
            });
        }

        return Promise.reject(error);
    },
);

export default api;
