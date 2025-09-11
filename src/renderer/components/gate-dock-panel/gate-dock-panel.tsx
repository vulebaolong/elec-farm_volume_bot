import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// Types should mirror main/gate-dock.ts
export type DockMode = "right" | "bottom" | "overlay" | "hidden";
export type GateDockState = {
    mode: DockMode;
    ratio: number; // 0..1 used for right/bottom
    overlay: { w: number; h: number; corner: "tl" | "tr" | "bl" | "br"; margin: number };
};

const corners: GateDockState["overlay"]["corner"][] = ["tl", "tr", "bl", "br"];

export default function GateDockPanel() {
    const [st, setSt] = useState<GateDockState | null>(null);
    const canResize = st?.mode === "right" || st?.mode === "bottom";

    // --- load initial state ---
    useEffect(() => {
        (async () => {
            try {
                const s = (await (window as any).electron.ipcRenderer.invoke("gate:get-state")) as GateDockState;
                if (s) setSt(s);
            } catch (e) {
                console.error("gate:get-state failed", e);
            }
        })();
    }, []);

    // helpers
    const setMode = async (mode: DockMode) => {
        if (!st) return;
        const next = { ...st, mode } as GateDockState;
        setSt(next);
        await (window as any).electron.ipcRenderer.invoke("gate:set-dock", { mode });
    };

    const setRatio = async (ratio: number) => {
        if (!st) return;
        const r = Math.min(0.85, Math.max(0.2, ratio));
        setSt({ ...st, ratio: r });
        await (window as any).electron.ipcRenderer.invoke("gate:set-ratio", r);
    };

    const setOverlayCorner = async (corner: GateDockState["overlay"]["corner"]) => {
        if (!st) return;
        const next = { ...st, mode: "overlay", overlay: { ...st.overlay, corner } } as GateDockState;
        setSt(next);
        await (window as any).electron.ipcRenderer.invoke("gate:move-overlay", corner);
    };

    const setOverlaySize = async (patch: Partial<GateDockState["overlay"]>) => {
        if (!st) return;
        const next = { ...st, overlay: { ...st.overlay, ...patch } } as GateDockState;
        setSt(next);
        await (window as any).electron.ipcRenderer.invoke("gate:set-dock", { overlay: patch });
    };

    const toggle = async () => {
        const nextMode: DockMode = st?.mode === "hidden" ? "right" : "hidden";
        await (window as any).electron.ipcRenderer.invoke("gate:toggle");
        if (st) setSt({ ...st, mode: nextMode });
    };

    if (!st) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Gate Dock</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Loading dock state…</CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Gate Dock</CardTitle>
                <div className="flex gap-2">
                    <Button size="sm" variant={st.mode !== "hidden" ? "default" : "secondary"} onClick={toggle}>
                        {st.mode !== "hidden" ? "Hide" : "Show"}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Mode selector */}
                <div className="flex flex-wrap gap-2">
                    {(["right", "bottom", "overlay", "hidden"] as DockMode[]).map((m) => (
                        <Button
                            key={m}
                            size="sm"
                            variant={st.mode === m ? "default" : "outline"}
                            onClick={() => setMode(m)}
                            className={cn("capitalize")}
                        >
                            {m}
                        </Button>
                    ))}
                </div>

                {/* Ratio for right/bottom */}
                {canResize && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <div>Size</div>
                            <div className="text-muted-foreground">{Math.round(st.ratio * 100)}%</div>
                        </div>
                        <Slider value={[st.ratio]} min={0.2} max={0.85} step={0.01} onValueChange={(v) => setRatio(v[0])} />
                    </div>
                )}

                {/* Overlay controls */}
                {st.mode === "overlay" && (
                    <div className="space-y-3">
                        <div className="text-sm">Overlay size</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-16 text-sm text-muted-foreground">Width</div>
                                <Input value={st.overlay.w} onChange={(e) => setOverlaySize({ w: Number(e.target.value) || 0 })} className="h-8" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-16 text-sm text-muted-foreground">Height</div>
                                <Input value={st.overlay.h} onChange={(e) => setOverlaySize({ h: Number(e.target.value) || 0 })} className="h-8" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-16 text-sm text-muted-foreground">Margin</div>
                                <Input
                                    value={st.overlay.margin}
                                    onChange={(e) => setOverlaySize({ margin: Number(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-16 text-sm text-muted-foreground">Corner</div>
                                <div className="flex gap-2">
                                    {corners.map((c) => (
                                        <Button
                                            key={c}
                                            size="sm"
                                            variant={st.overlay.corner === c ? "default" : "outline"}
                                            onClick={() => setOverlayCorner(c)}
                                            className="uppercase"
                                        >
                                            {c}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
