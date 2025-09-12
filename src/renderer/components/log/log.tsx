// components/MainLogViewer.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowDownToLine, Copy, FolderOpen, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as ScrollArea from "@radix-ui/react-scroll-area";

type Level = "all" | "error" | "warn" | "info" | "verbose" | "debug" | "silly";

const MAX_LINES = 0;
const BOTTOM_EPS = 24;

function humanBytes(n?: number | null) {
    if (n == null) return "—";
    if (n < 1024) return `${n} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let i = -1,
        v = n;
    do {
        v /= 1024;
        i++;
    } while (v >= 1024 && i < units.length - 1);
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}
function basename(p: string) {
    const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
    return i >= 0 ? p.slice(i + 1) : p;
}
function detectLevel(line: string): Exclude<Level, "all"> {
    const m = line.match(/\[(silly|debug|verbose|info|warn|error)\]/i);
    if (m) return m[1].toLowerCase() as any;
    const t = line.match(/\b(ERROR|WARN|INFO|VERBOSE|DEBUG|SILLY)\b/);
    if (t) return t[1].toLowerCase() as any;
    return "info";
}
function levelTint(level: Exclude<Level, "all">) {
    switch (level) {
        case "error":
            return "bg-red-500/10 text-red-500 border-red-500/30";
        case "warn":
            return "bg-amber-500/10 text-amber-500 border-amber-500/30";
        case "info":
            return "bg-sky-500/10 text-sky-500 border-sky-500/30";
        case "verbose":
            return "bg-violet-500/10 text-violet-500 border-violet-500/30";
        case "debug":
            return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
        case "silly":
            return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
    }
}

type Entry = { text: string; level: Exclude<Level, "all"> };

export default function Log({ className }: { className?: string }) {
    const [path, setPath] = useState<string>("");
    const [size, setSize] = useState<number | null>(null);
    const [level, setLevel] = useState<Level>("all");
    const [entries, setEntries] = useState<Entry[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);

    const viewportRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let off: undefined | (() => void);
        (async () => {
            const [p, txt, sz] = await Promise.all([
                window.electron.ipcRenderer.invoke("logs:path"),
                window.electron.ipcRenderer.invoke("logs:read"),
                window.electron.ipcRenderer.invoke("logs:size").catch(() => null),
            ]);
            setPath(p ?? "");
            setSize(typeof sz === "number" ? sz : null);

            const init = String(txt ?? "")
                .split(/\r?\n/)
                .filter(Boolean)
                .map((t: string) => ({ text: t, level: detectLevel(t) }));
            setEntries(init.slice(-MAX_LINES));

            off = window.electron.ipcRenderer.on("log:append", (line: string) => {
                setEntries((prev) => {
                    const next = [...prev, { text: line, level: detectLevel(line) }];
                    return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
                });
                window.electron.ipcRenderer.invoke("logs:size").then((n) => setSize(Number(n) || 0));
                if (autoScroll) queueMicrotask(scrollToBottom); // ← chỉ dính nếu vẫn ở đáy
            });
        })();
        return () => off?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoScroll]);

    const filtered = useMemo(() => (level === "all" ? entries : entries.filter((e) => e.level === level)), [entries, level]);

    function scrollToBottom() {
        const n = viewportRef.current;
        if (!n) return;
        n.scrollTop = n.scrollHeight;
    }

    useEffect(() => {
        if (autoScroll) scrollToBottom();
    }, [filtered, autoScroll]);

    function onViewportScroll() {
        const n = viewportRef.current;
        if (!n) return;
        const atBottom = n.scrollTop + n.clientHeight >= n.scrollHeight - BOTTOM_EPS;
        setAutoScroll(atBottom);
    }

    async function onClear() {
        await window.electron.ipcRenderer.invoke("logs:clear");
        setEntries([]);
        setSize(0);
    }
    async function onReveal() {
        await window.electron.ipcRenderer.invoke("logs:reveal");
    }
    async function copyPath() {
        if (path) await navigator.clipboard.writeText(path);
    }

    return (
        <TooltipProvider>
            <Card className={cn("p-0 gap-0", className)}>
                <CardHeader className="p-2 gap-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Level filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Level</span>
                            <Select value={level} onValueChange={(v: Level) => setLevel(v)}>
                                <SelectTrigger size="sm" className="w-[100px]">
                                    <SelectValue placeholder="all" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(["all", "error", "warn", "info", "verbose", "debug", "silly"] as Level[]).map((lv) => (
                                        <SelectItem key={lv} value={lv}>
                                            {lv}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator orientation="vertical" className="h-6" />

                        {/* Size */}
                        <Badge variant="outline" className="text-xs ">
                            <p className="truncate max-w-[50px]">{humanBytes(size)}</p>
                        </Badge>

                        {/* Path (truncated + tooltip + copy) */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-0">
                                    <div className="max-w-[100px] truncate text-xs text-muted-foreground cursor-default">
                                        {path ? `${basename(path)}: ${path}` : "—"}
                                    </div>
                                    <Button className="h-6 w-6" variant="ghost" onClick={copyPath}>
                                        <Copy className="!h-3 !w-3" />
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[560px]">
                                <div className="text-xs leading-none">{path || "No path"}</div>
                            </TooltipContent>
                        </Tooltip>

                        <div className="ml-auto flex items-center gap-2">
                            <Button
                                disabled={autoScroll}
                                className="h-6 w-6"
                                variant="default"
                                onClick={() => {
                                    setAutoScroll(true);
                                    scrollToBottom();
                                }}
                            >
                                <ArrowDownToLine className="!h-3 !w-3" />
                            </Button>

                            <Button className="h-6 w-6" variant="default" onClick={onReveal}>
                                <FolderOpen className="!h-3 !w-3" />
                            </Button>

                            <Button className="h-6 w-6" variant="destructive" onClick={onClear}>
                                <Trash2 className="!h-3 !w-3" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-2">
                    <div className="rounded-xl border bg-background">
                        <div className="px-3 py-1.5 flex items-center justify-between">
                            <div className="text-[11px] text-muted-foreground">
                                Showing <span className="font-medium text-foreground">{filtered.length}</span> line{filtered.length !== 1 ? "s" : ""}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                                Autoscroll: <span className={autoScroll ? "text-foreground" : ""}>{autoScroll ? "on" : "off"}</span>
                            </div>
                        </div>

                        <Separator />

                        {/* 🔽 Scroll area bằng Radix primitives để có ref vào Viewport */}
                        <ScrollArea.Root type="auto" className="relative overflow-hidden">
                            <ScrollArea.Viewport ref={viewportRef} onScroll={onViewportScroll} className="h-[360px] w-full rounded-[inherit]">
                                {/* min-w-full: nếu nội dung ngắn hơn viewport thì vẫn full width
        px/py giữ padding; font-mono + text-xs như cũ */}
                                <div className="min-w-full px-3 py-2 font-mono text-xs leading-relaxed">
                                    {filtered.length === 0 ? (
                                        <div className="text-muted-foreground">No entries</div>
                                    ) : (
                                        filtered.map((e, i) => (
                                            <div
                                                key={i}
                                                // whitespace-pre: không wrap, giữ khoảng trắng
                                                // w-max: dòng có thể rộng hơn viewport để kéo ngang
                                                className={cn("border-l pl-2 mb-1 w-max whitespace-pre", levelTint(e.level))}
                                            >
                                                {e.text}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea.Viewport>

                            {/* 🔽 Horizontal scrollbar */}
                            <ScrollArea.Scrollbar
                                orientation="horizontal"
                                className="flex h-2 select-none touch-none p-0.5 bg-transparent transition-colors"
                            >
                                <ScrollArea.Thumb className="relative flex-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            </ScrollArea.Scrollbar>

                            {/* Vertical scrollbar (như cũ, có thể giữ style trước) */}
                            <ScrollArea.Scrollbar
                                orientation="vertical"
                                className="flex w-2 select-none touch-none p-0.5 bg-transparent transition-colors"
                            >
                                <ScrollArea.Thumb className="relative flex-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            </ScrollArea.Scrollbar>

                            <ScrollArea.Corner />
                        </ScrollArea.Root>
                    </div>
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
