// components/RateCountsPanel.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Copy, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CountEntry = {
    id: string; // rule id (vd: futures.place)
    key: string; // bucket key (vd: place:self hoặc priv:self:/apiw/...)
    count: number;
    createdAt: string;
    updatedAt: string;
    windowStartAt?: string; // ⟵ thêm: mốc bắt đầu cửa sổ hiện tại (ISO)
    limit?: number;
    windowMs?: number; // ⟵ thêm: độ dài cửa sổ (ms)
    basis?: "IP" | "UID";
};
type Snapshot = Record<string, CountEntry>;

function fmtDur(ms?: number | null) {
    if (!ms && ms !== 0) return "—";
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 100) / 10;
    return `${s}s`;
}

function usageColor(u: number) {
    if (u >= 0.95) return "bg-red-500/10 text-red-600";
    if (u >= 0.8) return "bg-amber-500/10 text-amber-600";
    return "bg-emerald-500/10 text-emerald-600";
}

export default function RateCountsPanel({ className }: { className?: string }) {
    const [path, setPath] = useState<string>("");
    const [data, setData] = useState<Snapshot>({});
    const [lastTs, setLastTs] = useState<number | null>(null);

    // tick mỗi giây để cập nhật "Reset" realtime
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        let off: undefined | (() => void);
        (async () => {
            const [p, snap] = await Promise.all([
                window.electron.ipcRenderer.invoke("rate:counts:path"),
                window.electron.ipcRenderer.invoke("rate:counts:snapshot"),
            ]);
            setPath(p ?? "");
            setData(snap ?? {});
            setLastTs(Date.now());

            off = window.electron.ipcRenderer.on("rate:counts:update", (payload: { ts: number; data: Snapshot }) => {
                setData(payload?.data ?? {});
                setLastTs(payload?.ts ?? Date.now());
            });
        })();
        return () => off?.();
    }, []);

    const rows = useMemo(() => {
        return Object.values(data).map((e) => {
            const limit = e.limit ?? 0;
            const usage = limit > 0 ? e.count / limit : 0;

            // tính reset realtime
            const wsMs = e.windowStartAt ? Date.parse(e.windowStartAt) : NaN;
            const hasWindow = e.windowMs != null && e.windowMs > 0 && !Number.isNaN(wsMs);
            const elapsed = hasWindow ? Math.max(0, now - wsMs) : 0;
            const resetInMs = hasWindow ? Math.max(0, (e.windowMs as number) - elapsed) : null;

            const exceeded = limit ? e.count > limit : false;
            const near = limit ? e.count >= Math.floor(limit * 0.9) : false;

            return { ...e, usage, resetInMs, exceeded, near };
        });
    }, [data, now]);

    async function copyPath() {
        if (path) await navigator.clipboard.writeText(path);
    }
    async function openPath() {
        await window.electron.ipcRenderer.invoke("rate:counts:reveal");
    }
    async function refreshOnce() {
        const snap = await window.electron.ipcRenderer.invoke("rate:counts:snapshot");
        setData(snap ?? {});
        setLastTs(Date.now());
    }
    async function clearCounts() {
        await window.electron.ipcRenderer.invoke("rate:counts:clear");
        const snap = await window.electron.ipcRenderer.invoke("rate:counts:snapshot");
        setData(snap ?? {});
        setLastTs(Date.now());
    }

    return (
        <TooltipProvider>
            <Card className={cn("p-0 gap-0", className)}>
                <CardHeader className="p-2 gap-0 border-b">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                            {rows.length} bucket{rows.length !== 1 ? "s" : ""}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px]">
                            last update: {lastTs ? new Date(lastTs).toLocaleTimeString() : "—"}
                        </Badge>

                        <div className="ml-auto flex items-center gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-0">
                                        <div className="max-w-[100px] truncate text-xs text-muted-foreground cursor-default">{path}</div>
                                        <Button className="h-6 w-6" variant="ghost" onClick={copyPath}>
                                            <Copy className="!h-3 !w-3" />
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[560px] break-all">
                                    <div className="text-xs leading-none">{path || "No path"}</div>
                                </TooltipContent>
                            </Tooltip>

                            {/* giữ nguyên 3 button và style */}
                            <div className="ml-auto flex items-center gap-2">
                                <Button className="h-6 w-6" variant="default" onClick={refreshOnce}>
                                    <RefreshCw className="!h-3 !w-3" />
                                </Button>

                                <Button className="h-6 w-6" variant="default" onClick={openPath}>
                                    <FolderOpen className="!h-3 !w-3" />
                                </Button>

                                <Button className="h-6 w-6" variant="destructive" onClick={clearCounts}>
                                    <Trash2 className="!h-3 !w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-2">
                    <div className="rounded-xl border bg-background">
                        {/* ⟵ thêm 2 cột: Window, Reset */}
                        <div className="grid grid-cols-[1.2fr_2.2fr_0.8fr_0.8fr_0.6fr_0.8fr_0.8fr_0.8fr_1fr_1fr] gap-x-3 px-3 py-2 text-[11px] text-muted-foreground border-b">
                            <div>Rule</div>
                            <div>Bucket key</div>
                            <div className="text-right">Count</div>
                            <div className="text-right">Limit</div>
                            <div>Basis</div>
                            <div className="text-right">Usage</div>
                            <div className="text-right">Window</div>
                            <div className="text-right">Reset</div>
                            <div>Created</div>
                            <div>Updated</div>
                        </div>

                        <ScrollArea.Root type="auto" className="relative overflow-hidden">
                            <ScrollArea.Viewport className="h-[380px] w-full rounded-[inherit]">
                                <div className="min-w-full">
                                    {rows.length === 0 ? (
                                        <div className="px-3 py-3 text-sm text-muted-foreground">No data</div>
                                    ) : (
                                        rows.map((r) => {
                                            const usage = r.limit ? r.count / r.limit : 0;
                                            const usagePct = r.limit ? Math.min(usage * 100, 999).toFixed(1) + "%" : "—";
                                            return (
                                                <div
                                                    key={`${r.id}|${r.key}`}
                                                    className="text-xs grid grid-cols-[1.2fr_2.2fr_0.8fr_0.8fr_0.6fr_0.8fr_0.8fr_0.8fr_1fr_1fr] gap-x-3 px-3 py-2 border-b hover:bg-muted/40"
                                                >
                                                    <div className="truncate" title={r.id}>
                                                        {r.id}
                                                    </div>
                                                    <div className="truncate" title={r.key}>
                                                        {r.key}
                                                    </div>

                                                    {/* Count + trạng thái */}
                                                    <div className="text-right tabular-nums">{r.count}</div>

                                                    <div className="text-right tabular-nums">{r.limit ?? "—"}</div>
                                                    <div className="uppercase text-xs">{r.basis ?? "—"}</div>

                                                    <div className="text-right">
                                                        <span className={cn("px-2 py-0.5 rounded-full text-[11px]", usageColor(usage))}>
                                                            {usagePct}
                                                        </span>
                                                    </div>

                                                    {/* Window & Reset realtime */}
                                                    <div className="text-right tabular-nums">{fmtDur(r.windowMs ?? null)}</div>
                                                    <div className="text-right tabular-nums">{fmtDur(r.resetInMs ?? null)}</div>

                                                    <div className="text-xs">{new Date(r.createdAt).toLocaleTimeString()}</div>
                                                    <div className="text-xs">{new Date(r.updatedAt).toLocaleTimeString()}</div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </ScrollArea.Viewport>

                            {/* scrollbars */}
                            <ScrollArea.Scrollbar orientation="horizontal" className="flex h-2 select-none p-0.5">
                                <ScrollArea.Thumb className="relative flex-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            </ScrollArea.Scrollbar>
                            <ScrollArea.Scrollbar orientation="vertical" className="flex w-2 select-none p-0.5">
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
