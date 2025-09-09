import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/constant/app.constant";
import { ROUTER } from "@/constant/router.constant";
import { navigateTo } from "@/helpers/navigate.helper";
import { RESET_USER } from "@/redux/slices/user.slice";
import { store } from "@/redux/store";

// ACCESS TOKEN
export const setAccessToken = (accessToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
};

export const getAccessToken = () => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) return null;
    return accessToken;
};

// REFRESH TOKEN
export const setRefreshToken = (refreshToken: string) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};
export const getRefreshToken = () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;
    return refreshToken;
};

export const logOut = () => {
    window.electron?.ipcRenderer.sendMessage("bot:stop");
    const theme = localStorage.getItem("theme");
    localStorage.clear();
    if (theme) localStorage.setItem("theme", theme);
    const dispatch = store.dispatch;
    dispatch(RESET_USER());
    navigateTo(ROUTER.LOGIN);
};
