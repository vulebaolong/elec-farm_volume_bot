import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { ROUTER } from "@/constant/router.constant";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const useAuthCheck = () => {
    const getInfoMutation = useGetInfoMutation();
    const location = useLocation();

    useEffect(() => {
        // Không gọi ở login/register
        const publicRoutes = [ROUTER.LOGIN, ROUTER.REGISTER];
        if (publicRoutes.includes(location.pathname)) return;

        getInfoMutation.mutate();
    }, [location.pathname]);
};
