// use-socket-emit.ts
import { useMutation } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { useRefreshToken } from "./auth.tanstack";
import { TSocketRes } from "@/types/base.type";
import { getAccessToken, getRefreshToken } from "../auth/app.auth";

type UseSocketEmitOptions = {
    socket: Socket | null | undefined;
    event: string;
    /** tên field gắn token vào payload */
    tokenKey?: string; // default: "accessToken"
    /** timeout đợi ack */
    timeoutMs?: number; // default: 10000
    /** log tùy chọn */
    logger?: (type: "emit" | "retry" | "error", detail: any) => void;
};

function isForbidden(res: TSocketRes<any>) {
    return res.code === 403;
}
function isErrorAck(res: TSocketRes<any>) {
    if (res.code === 403) return false;
    return res.code >= 400;
}
function emitWithAck<T>(socket: Socket, event: string, payload: any, timeoutMs = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const t = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error(`Ack timeout for "${event}" after ${timeoutMs}ms`));
            }
        }, timeoutMs);

        try {
            socket.emit(event, payload, (ack: Promise<T>) => {
                if (settled) return;
                settled = true;
                clearTimeout(t);
                resolve(ack);
            });
        } catch (e) {
            clearTimeout(t);
            reject(e);
        }
    });
}

/**
 * Dùng:
 * const createRoom = useSocketEmit<{ targetUserIds: string[]; name?: string }, { chatGroupId: string }>({
 *   socket, event: "CREATE_ROOM",
 * });
 * await createRoom.mutateAsync({ targetUserIds: [...], name });
 */
export function useSocketEmit<T>({ socket, event, timeoutMs = 10000, logger }: UseSocketEmitOptions) {
    const refreshMut = useRefreshToken();

    return useMutation({
        mutationKey: ["socket-emit", event],
        mutationFn: async (payload?: any): Promise<TSocketRes<T>> => {
            if (!socket || !socket.connected) {
                throw new Error("SOCKET_NOT_CONNECTED");
            }

            // --- lần 1: dùng accessToken hiện tại ---
            const accessToken = getAccessToken();
            if (!accessToken) {
                throw new Error("NO_ACCESS_TOKEN");
            }
            logger?.("emit", { event, payload: { ...payload, accessToken: accessToken } });

            let ack = await emitWithAck<TSocketRes<T>>(socket, event, { ...payload, accessToken: accessToken }, timeoutMs);

            console.log({ ack });

            // Nếu 403 → refresh & retry 1 lần
            if (isForbidden(ack)) {
                const refresh = getRefreshToken();
                if (!refresh) {
                    logger?.("error", { event, reason: "NO_REFRESH_TOKEN" });
                    throw new Error("NO_REFRESH_TOKEN");
                }

                const refreshed = await refreshMut.mutateAsync({
                    accessToken: accessToken,
                    refreshToken: refresh,
                });

                // refreshed chứa accessToken/refreshToken mới đã được set vào cookie qua refreshTokenAction
                const newAccess = (refreshed as any)?.accessToken;
                if (!newAccess) {
                    logger?.("error", { event, reason: "REFRESH_FAILED" });
                    throw new Error("REFRESH_FAILED");
                }

                logger?.("retry", { event });
                ack = await emitWithAck<TSocketRes<T>>(socket, event, { ...payload, accessToken: refreshed.data.accessToken }, timeoutMs);
            }

            if (isErrorAck(ack)) {
                const err = new Error(ack?.message || "Socket emit failed");
                (err as any).ack = ack;
                throw err;
            }

            return ack
        },
    });
}
