// renderer/hooks/useMetrics.ts
import { useEffect, useRef, useState } from "react";

export function useMetrics(intervalMs = 2000, history = 120) {
    const [latest, setLatest] = useState<any | null>(null);
    const [series, setSeries] = useState<any[]>([]);
    const alive = useRef(true);

    useEffect(() => {
        alive.current = true;

        const tick = async () => {
            try {
                const s = await window.electron.ipcRenderer.invoke("metrics");
                if (!alive.current) return;
                setLatest(s);
                setSeries((prev) => {
                    const arr = [...prev, s];
                    return arr.length > history ? arr.slice(-history) : arr;
                });
            } catch (e) {
                // swallow; có thể log nhẹ
            }
        };

        tick();
        const t = setInterval(tick, intervalMs);
        return () => {
            alive.current = false;
            clearInterval(t);
        };
    }, [intervalMs, history]);

    // cảnh báo đơn giản: heapUsed tăng liên tiếp 5 mẫu
    const leakHint = (() => {
        if (series.length < 6) return null;
        const last6 = series.slice(-6).map((s) => s.main.heap.heapUsed);
        const rising = last6.every((v, i, a) => i === 0 || v >= a[i - 1]);
        return rising ? "Heap used tăng liên tục (có thể rò rỉ)." : null;
    })();

    return { latest, series, leakHint };
}
