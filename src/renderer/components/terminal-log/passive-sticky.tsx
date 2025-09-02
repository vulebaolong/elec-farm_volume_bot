// PassiveSticky.tsx (phiên bản dùng key/text, không có nút)
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useState } from "react";

type StickySet = { key: string; text: string; ts: number };

export default function PassiveSticky() {
    const [map, setMap] = useState<Record<string, StickySet>>({});

    useEffect(() => {
        const offSet = window.electron.ipcRenderer.on("bot:sticky:set", (p: StickySet) => {
            setMap((prev) => ({ ...prev, [p.key]: p }));
        });
        const offRemove = window.electron.ipcRenderer.on("bot:sticky:remove", (p: { key: string }) => {
            setMap(({ [p.key]: _omit, ...rest }) => rest);
        });
        const offClear = window.electron.ipcRenderer.on("bot:sticky:clear", () => setMap({}));
        return () => {
            offSet?.();
            offRemove?.();
            offClear?.();
        };
    }, []);

    const list = useMemo(() => Object.values(map).sort((a, b) => b.ts - a.ts), [map]);

    // if (list.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <Badge variant="secondary">Sticky</Badge>
                <span className="text-xs text-muted-foreground">
                    {list.length} {list.length === 1 ? "item" : "items"}
                </span>
            </div>

            <div className="w-[320px] max-w-[80vw] flex-1 rounded-xl border bg-black/85 text-neutral-100 shadow-xl backdrop-blur">
                <ScrollArea className="max-h-[50vh] p-2">
                    <ul className="space-y-1">
                        {list.map((it) => (
                            <li key={it.key} className="rounded-md border border-white/5 bg-white/5 px-3 py-2">
                                <div className="font-mono text-xs md:text-sm truncate">{it.text}</div>
                                <div className="text-[10px] text-neutral-400">{new Date(it.ts).toLocaleTimeString()}</div>
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
            </div>
        </div>
    );
}
