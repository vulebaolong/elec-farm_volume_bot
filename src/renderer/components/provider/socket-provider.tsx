import { getAccessToken } from "@/api/auth/app.auth";
import { BASE_DOMAIN } from "@/constant/app.constant";
import { logRenderer } from "@/index";
import { useAppSelector } from "@/redux/store";
import { createContext, useEffect, useRef, useState } from "react";
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

    const initSocket = async () => {
        if (!info) return;

        // Nếu socket cũ còn tồn tại, ngắt kết nối và xoá
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        console.log("🔌 Initializing socket...");
        const accessToken = getAccessToken();
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
            console.warn("connect_error:", JSON.stringify(err));
            logRenderer.info("connect_error", JSON.stringify(err));
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
