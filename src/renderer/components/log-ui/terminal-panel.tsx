import { useLogs } from "@/helpers/log-store";
import { useEffect, useRef } from "react";

export function TerminalPanel() {
    const logs = useLogs();
    const boxRef = useRef<HTMLDivElement>(null);

    // auto scroll xuống cuối khi có log mới
    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [logs.length]);

    return (
        <div ref={boxRef} className="h-80 overflow-auto font-mono text-xs rounded-md">
            {logs.map((l) => (
                <div key={l.id} className={l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-yellow-400" : "text-gray-200"}>
                    {new Date(l.ts).toLocaleTimeString()} [{l.level.toUpperCase()}] {l.text}
                </div>
            ))}
        </div>
    );
}
