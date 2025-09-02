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
    const [paused, setPaused] = useState(false);
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

    // auto scroll khi có log mới & không pause
    useEffect(() => {
        if (paused) return;
        const el = viewRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [visible, paused]);

    const copyAll = async () => {
        const text = visible.map((l) => `[${new Date(l.ts).toLocaleTimeString()}] ${l.level.toUpperCase()} ${l.text}`).join("\n");
        await navigator.clipboard.writeText(text);
    };

    return (
        <Card className={className}>
            {/* <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                    <Badge variant="secondary">Terminal</Badge>
                    <div className="text-xs text-muted-foreground">{visible.length} lines</div>
                </div>
                <div className="flex items-center gap-2">
                    <Input placeholder="Filter..." value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-[180px]" />
                    <div className="hidden md:flex gap-1">
                        {(["info", "warn", "error"] as LogLevel[]).map((l) => (
                            <Button
                                key={l}
                                variant={levels[l] ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setLevels((s) => ({ ...s, [l]: !s[l] }))}
                            >
                                {l}
                            </Button>
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPaused((p) => !p)}
                        title={paused ? "Resume autoscroll" : "Pause autoscroll"}
                    >
                        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={copyAll} title="Copy visible logs">
                        <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => window.dispatchEvent(new CustomEvent("terminal:clear"))}
                        title="Clear (emit event)"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader> */}

            <CardContent className="p-0">
                <div ref={viewRef} className="h-52 w-full overflow-auto rounded-md bg-black text-neutral-100 p-2 font-mono text-xs leading-relaxed">
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
                <WorkerMetrics />
            </CardContent>
        </Card>
    );
}
