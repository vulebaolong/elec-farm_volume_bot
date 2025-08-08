import { logOut } from '@/api/auth/app.auth';
import { useGetInfoMutation } from '@/api/tanstack/auth.tanstack';
import { ROUTER } from '@/constant/router.constant';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useAuthCheck = () => {
  const getInfoMutation = useGetInfoMutation();
  const location = useLocation();

  useEffect(() => {
    // Không gọi ở login/register
    const publicRoutes = [ROUTER.LOGIN, ROUTER.REGISTER];
    if (publicRoutes.includes(location.pathname)) return;

    const check = async () => {
      try {
        await getInfoMutation.mutateAsync();
      } catch (err: any) {
        // Nếu 403 thì không logout (có thể đang chờ refresh)
        if (err.response?.status === 403) {
          console.log(`Nếu 403 thì không logout (có thể đang chờ refresh)`);
          return
        };

        // Các lỗi khác thì logout
        logOut();
      }
    };

    check();
  }, [location.pathname]);
};
