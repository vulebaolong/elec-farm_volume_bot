// Một store tối giản cho "terminal log"
export type LogLevel = "info" | "warn" | "error";
export type LogEntry = { id: number; ts: number; level: LogLevel; text: string };

let counter = 0;
let entries: LogEntry[] = [];
const subs = new Set<() => void>();
const MAX = 2000; // ring buffer

export function appendLog(level: LogLevel, text: string) {
    const entry = { id: ++counter, ts: Date.now(), level, text };
    // ❗️Tạo mảng MỚI thay vì push
    entries = entries.length >= MAX ? [...entries.slice(-MAX + 1), entry] : [...entries, entry];
    subs.forEach((fn) => fn());
}

export function getSnapshot() {
    // chỉ trả về dữ liệu (không phải tham chiếu subs)
    return entries;
}
export function subscribe(cb: () => void) {
    subs.add(cb);
    return () => subs.delete(cb);
}

// Hook dùng trong React
import { useSyncExternalStore } from "react";
export function useLogs() {
    return useSyncExternalStore(subscribe, getSnapshot);
}
