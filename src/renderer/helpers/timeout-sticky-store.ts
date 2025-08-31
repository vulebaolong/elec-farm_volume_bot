// stores/timeoutStickyStore.ts
import { useSyncExternalStore } from "react";

export type Sticky = { key: string; ts: number; text: string };

const listeners = new Set<() => void>();
const map = new Map<string, Sticky>();

let stickies: Sticky[] = []; // <- snapshot cache (mảng mới chỉ khi thay đổi)

function emit() {
    listeners.forEach((l) => l());
}
function rebuild() {
    stickies = Array.from(map.values());
}

export function setSticky(key: string, text: string) {
    const prev = map.get(key);
    if (!prev || prev.text !== text) {
        map.set(key, { key, ts: Date.now(), text });
        rebuild();
        emit();
    }
}
export function removeSticky(key: string) {
    if (map.delete(key)) {
        rebuild();
        emit();
    }
}
export function clearStickies() {
    map.clear();
    rebuild();
    emit();
}

// glue
export function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
export function getSnapshot() {
    return stickies; // ✅ ổn định, chỉ đổi khi rebuild()
}
export function useStickies() {
    return useSyncExternalStore(subscribe, getSnapshot);
}
