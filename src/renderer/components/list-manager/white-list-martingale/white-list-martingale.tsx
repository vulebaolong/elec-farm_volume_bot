import { useGetContractSymbol } from "@/api/tanstack/contract.tanstack";
import {
    useClearAllWhiteListMartingale,
    useCreateWhiteListMartingale,
    useGetAllWhiteListMartingale,
    useRemoveWhiteListMartingale,
} from "@/api/tanstack/white-list-martingale.tanstack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function WhitelistMartingale() {
    const { data, isLoading, isError } = useGetContractSymbol();
    const { data: whiteListMartingaleData } = useGetAllWhiteListMartingale();
    const createWhiteListMartingale = useCreateWhiteListMartingale();
    const removeWhiteListMartingale = useRemoveWhiteListMartingale();
    const clearAllWhiteListMartingale = useClearAllWhiteListMartingale();

    const [q, setQ] = useState("");
    const [whiteListMartingale, setWhiteListMartingale] = useState<string[]>([]);

    const allSymbols = useMemo(() => (data ?? []).map((s) => s.symbol).sort(), [data]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return allSymbols.filter((s) => !whiteListMartingale.includes(s) && (qq ? s.toLowerCase().includes(qq) : true));
    }, [allSymbols, whiteListMartingale, q]);

    useEffect(() => {
        if (!whiteListMartingaleData) return;
        setWhiteListMartingale(whiteListMartingaleData.map((x) => x.symbol));
    }, [whiteListMartingaleData]);

    const add = (sym: string) => {
        createWhiteListMartingale.mutate({ symbol: sym });
        setWhiteListMartingale((prev) => (prev.includes(sym) ? prev : [...prev, sym]));
    };

    const remove = (sym: string) => {
        removeWhiteListMartingale.mutate({ symbol: sym });
        setWhiteListMartingale((prev) => prev.filter((x) => x !== sym));
    };

    const clearAll = () => {
        clearAllWhiteListMartingale.mutate();
        setWhiteListMartingale([]);
    };

    // Enter để add nhanh kết quả đầu tiên
    const onSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter" && filtered[0]) {
            add(filtered[0]);
            setQ("");
        }
    };

    return (
        <div className="w-full">
            <p className="text-xl font-bold text-muted-foreground">WhiteList Martingale {whiteListMartingale.length}</p>

            <div className="grid gap-3 mt-5">
                {/* Search & Results */}
                <Card className="border-border p-0 gap-0 rounded-md">
                    <CardHeader className="p-0 gap-0 h-[39px] border-b bg-muted/50">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                onKeyDown={onSearchKeyDown}
                                placeholder="Tìm symbol (VD: BTC_USDT)"
                                className="border-none  pl-8"
                                autoComplete="off"
                            />
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <ScrollArea className="h-[203px]">
                            <div className="divide-y">
                                {isLoading && <div className="p-4 text-sm text-muted-foreground">Đang tải…</div>}
                                {isError && <div className="p-4 text-sm text-red-500">Không lấy được danh sách symbol.</div>}
                                {!isLoading && !isError && filtered.length === 0 && (
                                    <div className="p-4 text-sm text-muted-foreground">Không có kết quả phù hợp.</div>
                                )}
                                {filtered.map((sym) => (
                                    <div key={sym} className="flex items-center justify-between px-4 py-2 hover:bg-muted/40">
                                        <span className="font-mono text-sm">{sym}</span>
                                        <Button variant="secondary" size="sm" className="gap-1" onClick={() => add(sym)}>
                                            <Plus className="h-4 w-4" />
                                            Thêm
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* RIGHT: WhiteList Martingale */}
                <Card className="border-border p-0 gap-0 rounded-md">
                    <CardHeader className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">WhiteList Martingale hiện tại</h3>
                            <Badge variant="secondary">{whiteListMartingale.length}</Badge>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1 !h-full"
                            onClick={clearAll}
                            disabled={whiteListMartingale.length === 0}
                        >
                            <Trash2 className="!h-3 !w-3" />
                            <span className="!text-sm">Clear all</span>
                        </Button>
                    </CardHeader>

                    <CardContent className="p-0">
                        <ScrollArea className="h-[203px]">
                            {whiteListMartingale.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground">Chưa có symbol nào trong whiteListMartingale.</div>
                            ) : (
                                <div className="p-3 flex flex-wrap gap-2">
                                    {whiteListMartingale.map((sym) => (
                                        <span
                                            key={sym}
                                            className={cn(
                                                "group inline-flex items-center gap-1 rounded-full px-2 py-1",
                                                // light
                                                "bg-red-500/10 text-red-700 ring-1 ring-red-500/25",
                                                // dark: tăng tương phản
                                                "dark:bg-red-400/15 dark:text-red-100 dark:ring-red-400/30",
                                            )}
                                        >
                                            <span className="font-mono text-xs">{sym}</span>

                                            <button
                                                aria-label={`Remove ${sym}`}
                                                onClick={() => remove(sym)}
                                                className={cn(
                                                    "rounded-full p-0.5 transition",
                                                    // light
                                                    "text-red-600 hover:bg-red-500/15 hover:text-red-700",
                                                    // dark
                                                    "dark:text-red-300 dark:hover:bg-red-400/20 dark:hover:text-red-50",
                                                    // focus ring rõ ràng ở cả 2 theme
                                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 dark:focus-visible:ring-offset-zinc-900",
                                                )}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
