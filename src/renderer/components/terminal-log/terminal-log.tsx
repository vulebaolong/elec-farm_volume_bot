import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Pause, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import WorkerMetrics from "../worker-metrics/worker-metrics";

export type LogLevel = "info" | "warn" | "error";
export type LogLine = { ts: number; level: LogLevel; text: string };

type Props = {
    lines: LogLine[];
    maxLines?: number; // cắt đuôi để tránh phình bộ nhớ
    className?: string;
};

export default function TerminalLog({ lines, maxLines = 2000, className }: Props) {
    const [q, setQ] = useState("");
    const [levels, setLevels] = useState<Record<LogLevel, boolean>>({
        info: true,
        warn: true,
        error: true,
    });

    // cắt đuôi + filter
    const visible = useMemo(() => {
        const cut = lines.length > maxLines ? lines.slice(-maxLines) : lines;
        return cut.filter((l) => levels[l.level] && (q ? l.text.toLowerCase().includes(q.toLowerCase()) : true));
    }, [lines, q, levels, maxLines]);

    const viewRef = useRef<HTMLDivElement>(null);

    // trạng thái “đang ở cuối” (dùng ref để tránh re-render liên tục khi scroll)
    const stickRef = useRef(true);
    const THRESHOLD = 8; // px dung sai coi là “đang ở cuối”

    useEffect(() => {
        const el = viewRef.current;
        if (!el) return;

        const onScroll = () => {
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - THRESHOLD;
            stickRef.current = atBottom;
        };

        // set initial
        onScroll();
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    // auto scroll chỉ khi đang ở cuối
    useEffect(() => {
        if (!stickRef.current) return;
        const el = viewRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [visible]);

    const copyAll = async () => {
        const text = visible.map((l) => `[${new Date(l.ts).toLocaleTimeString()}] ${l.level.toUpperCase()} ${l.text}`).join("\n");
        await navigator.clipboard.writeText(text);
    };

    return (
        <Card className={className}>
            <CardContent className="p-0">
                <div
                    ref={viewRef}
                    className="h-52 w-full overflow-auto rounded-md bg-black text-neutral-100 p-2 font-mono text-[10px] leading-relaxed"
                >
                    {visible.map((l, i) => (
                        <div key={i} className="whitespace-pre-wrap">
                            <span className="text-neutral-500">[{new Date(l.ts).toLocaleTimeString()}]</span>{" "}
                            <span className={l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-amber-300" : "text-sky-300"}>
                                {l.level.toUpperCase()}
                            </span>{" "}
                            <span>{l.text}</span>
                        </div>
                    ))}
                </div>
                {/* <WorkerMetrics /> */}
            </CardContent>
        </Card>
    );
}
