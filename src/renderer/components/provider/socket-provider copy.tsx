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
    const prevKeyRef = useRef<string | number | undefined>(undefined);
    const [isConnected, setIsConnected] = useState(false);
    const info = useAppSelector((s) => s.user.info);

    const userKey = info?.id; // chỉ init khi đã có user
    const token = getAccessToken(); // hoặc lấy từ store nếu bạn lưu ở đó

    useEffect(() => {
        // Chưa có user hoặc token -> chưa init
        if (!userKey || !token) return;

        // Nếu cùng userKey và đã có socket -> không re-init
        if (prevKeyRef.current === userKey && socketRef.current) return;

        // Teardown instance cũ nếu có (user đổi)
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        // Init mới
        const socket = io(BASE_DOMAIN, {
            auth: { token },
            transports: ["websocket", "polling"],
        });
        socketRef.current = socket;
        prevKeyRef.current = userKey;

        const onConnect = () => {
          console.log(`✅ Connected: ${socket.id}`);
          setIsConnected(true);
        }
        const onDisconnect = () => {
          console.log(`❌ Disconnected: ${socket.id}`);
          setIsConnected(false)
        };
        const onConnectError = async (err: any) => {
            console.warn("connect_error:", err.message);
            switch (err.message) {
                case "TOKEN_EXPIRED": {
                    const rt = getRefreshToken();
                    const at = getAccessToken();
                    if (!rt || !at) return logOut();
                    // ... gọi refresh, xong thì:
                    // socket.auth = { token: getAccessToken() };
                    // socket.connect(); // thử reconnect thay vì tạo socket mới
                    break;
                }
                case "INVALID_TOKEN":
                case "USER_NOT_FOUND":
                default:
                    logOut();
            }
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onConnectError);

        return () => {
            // cleanup đúng listener
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onConnectError);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [userKey, token]);

    // Tránh tạo object mới mỗi render
    // const value = useMemo<SocketContextType>(() => ({ socket: socketRef.current, isConnected }), [isConnected]);

    return <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>{children}</SocketContext.Provider>;
}
