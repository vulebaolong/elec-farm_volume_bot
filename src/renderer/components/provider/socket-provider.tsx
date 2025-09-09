import { getAccessToken, getRefreshToken, logOut } from "@/api/auth/app.auth";
import { useRefreshToken } from "@/api/tanstack/auth.tanstack";
import { BASE_DOMAIN } from "@/constant/app.constant";
import { useAppSelector } from "@/redux/store";
import { TRefreshTokenReq } from "@/types/login.type";
import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

type TProps = {
    children: React.ReactNode;
};

export default function SocketProvider({ children }: TProps) {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const info = useAppSelector((state) => state.user.info);
    const handleRefreshToken = useRefreshToken();

    const initSocket = async () => {
        if (!info) return;

        // Nếu socket cũ còn tồn tại, ngắt kết nối và xoá
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        console.log("🔌 Initializing socket...");
        const accessToken =  getAccessToken();
        const socket = io(BASE_DOMAIN, {
            auth: { token: accessToken },
            transports: ["websocket", "polling"],
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            console.log(`✅ Connected: ${socket.id}`);
            setIsConnected(true);
        });

        socket.on("disconnect", () => {
            console.log("❌ Disconnected");
            setIsConnected(false);
        });

        socket.on("connect_error", async (err: any) => {
            // err.message: 'NO_TOKEN' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN' | 'USER_NOT_FOUND'
            console.warn("connect_error:", err.message);

            switch (err.message) {
                case "TOKEN_EXPIRED":
                    const refreshToken = getRefreshToken();
                    const accessToken = getAccessToken();

                    if (!refreshToken || !accessToken) {
                        logOut();
                        return;
                    }
                    const payload: TRefreshTokenReq = {
                        refreshToken,
                        accessToken,
                    };

                    handleRefreshToken.mutate(payload, {
                        onSuccess: () => {
                            console.log("🔄 Token refreshed. Reinitializing socket...");
                            initSocket(); // 🔁 Đệ quy khởi động lại
                        },
                        onError: () => {
                            logOut();
                        },
                    });
                    break;

                case "INVALID_TOKEN":
                    logOut();
                    break;

                case "USER_NOT_FOUND":
                    logOut();
                    break;

                default:
                    logOut();
                    break;
            }
        });
    };

    useEffect(() => {
        initSocket();

        return () => {
            if (socketRef.current) {
                console.log("🔌 Closing socket...");
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [info?.id]);

    return <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>{children}</SocketContext.Provider>;
}
