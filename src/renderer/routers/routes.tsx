import AppError from "@/components/app-error/app-error";
import NotFound from "@/components/not-found/not-found";
import { ROUTER } from "@/constant/router.constant";
import { setNavigate } from "@/helpers/navigate.helper";
import AuthLayout from "@/layouts/auth-layout";
import MainLayout from "@/layouts/main-layout";
import Home from "@/components/home/home";
import { LoginForm } from "@/components/login/login-form";
import { Register } from "@/components/register/register";
import { useEffect } from "react";
import { useNavigate, useRoutes } from "react-router-dom";
import Setting from "@/components/setting/setting";
import SettingDev from "@/components/setting-dev/setting-dev";
import ListManager from "@/components/list-manager/list-manager";
import UserManager from "@/components/user-manager/user-manager";

export const routes = [
    {
        element: <MainLayout />,
        errorElement: <AppError />,
        children: [
            {
                path: ROUTER.HOME,
                element: <Home />,
            },
            {
                path: ROUTER.SETTING,
                element: <Setting />,
            },
            {
                path: ROUTER.SETTING_DEV,
                element: <SettingDev />,
            },
            {
                path: ROUTER.LIST_MANAGER,
                element: <ListManager />,
            },
            {
                path: ROUTER.USER_MANAGER,
                element: <UserManager />,
            },
        ],
    },
    {
        element: <AuthLayout />,
        errorElement: <AppError />,
        children: [
            {
                path: ROUTER.LOGIN,
                element: <LoginForm />,
            },
            {
                path: ROUTER.REGISTER,
                element: <Register />,
            },
        ],
    },
    {
        path: "*",
        element: <NotFound />,
    },
];

export default function AppRoutes() {
    const element = useRoutes(routes);
    const navigate = useNavigate();

    useEffect(() => {
        setNavigate(navigate);
    }, [navigate]);

    return element;
}
