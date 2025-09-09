import { Badge } from "@/components/ui/badge";
import { useSocket } from "@/hooks/socket.hook";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { TWhiteList, TWhitelistUi } from "@/types/white-list.type";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { handleEntryCheckAll } from "src/main/workers/util-bot.worker";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Button } from "../ui/button";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Whitelist({ open, onOpenChange }: TProps) {
    const socket = useSocket();
    const settingUser = useAppSelector((s) => s.user.info?.SettingUsers);
    const [whitelistUi, setWhitelistUi] = useState<TWhitelistUi[]>([]);

    // --- nhận socket ---
    useEffect(() => {
        if (!socket?.socket || !settingUser) return;
        const io = socket.socket;

        const handleEntry = ({ data }: TSocketRes<TWhiteList>) => {
            const whiteListArr = Object.values(data);
            const result: TWhitelistUi[] = [];

            for (const whitelistItem of whiteListArr) {
                const {
                    errString,
                    qualified,
                    result: r,
                } = handleEntryCheckAll({
                    whitelistItem,
                    settingUser,
                });

                if (errString) {
                    toast.error(errString);
                    continue;
                }
                if (r) {
                    result.push({
                        core: r.core,
                        isDepth: r.isDepth,
                        isLong: r.isLong,
                        isShort: r.isShort,
                        isSize: r.isSize,
                        isSpread: r.isSpread,
                        qualified,
                        sizeStr: r.sizeStr,
                        side: r.side,
                        symbol: r.symbol,
                    });
                }
            }

            setWhitelistUi(result);
        };

        io.on("entry", handleEntry);
        return () => {
            io.off("entry", handleEntry);
        };
    }, [socket?.socket, settingUser]);

    // === chia 2 ngăn ===
    const qualifiedList = useMemo(() => whitelistUi.filter((x) => x.qualified), [whitelistUi]);

    // Nếu muốn pane dưới chỉ hiển thị không-qualified, set false
    const includeQualifiedInAll = true;
    const allList = useMemo(
        () => (includeQualifiedInAll ? whitelistUi : whitelistUi.filter((x) => !x.qualified)),
        [whitelistUi, includeQualifiedInAll],
    );

    // Render 1 item (để tái sử dụng)
    const renderItem = (item: TWhitelistUi) => {
        const { core, isSpread, isDepth, sizeStr, isSize, qualified, isLong, isShort } = item;
        const sym = core.gate.symbol;

        return (
            <AccordionItem key={sym} value={sym} className={cn(qualified ? "border border-green-500 shadow-md rounded-md" : "border-0")}>
                <AccordionTrigger className="flex justify-between items-center px-4 py-2 rounded-md border shadow-sm bg-muted">
                    <div className="flex items-center gap-1 text-xs font-medium">
                        <span>{sym}</span>
                        <div className="flex gap-1">
                            <Badge variant={isLong ? "default" : "outline"} className={isLong ? "bg-green-500 text-white" : ""}>
                                Long
                            </Badge>
                            <Badge variant={isShort ? "default" : "outline"} className={isShort ? "bg-red-500 text-white" : ""}>
                                Short
                            </Badge>
                            <Badge variant={isDepth ? "default" : "outline"}>Depth</Badge>
                            <Badge variant={isSpread ? "default" : "outline"}>Spread</Badge>
                            <Badge variant={isSize ? "default" : "outline"}>Size</Badge>
                        </div>
                    </div>
                </AccordionTrigger>

                <AccordionContent className="bg-background px-4 py-2 text-sm space-y-1 rounded-md">
                    <div className="text-sm text-muted-foreground">
                        <span>Last Price (gate): </span>
                        <span className="font-medium text-foreground">{core.gate.lastPrice}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        <span>Last Price (binance): </span>
                        <span className="font-medium text-foreground">{core.binance.lastPrice}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-sm text-muted-foreground">Size:</span>
                        <Badge variant={isSize ? "default" : "outline"}>{sizeStr}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-sm text-muted-foreground">Spread %:</span>
                        <Badge variant={isSpread ? "default" : "outline"}>{core.gate.spreadPercent?.toFixed(2)}%</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-sm text-muted-foreground">Bid USD:</span>
                        <Badge variant={"outline"}>{core.gate.bidSumDepth}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-sm text-muted-foreground">Ask USD:</span>
                        <Badge variant={"outline"}>{core.gate.askSumDepth}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-sm text-muted-foreground">Imbalance Bid:</span>
                        <Badge variant={"outline"}>{core.gate.imbalanceBidPercent?.toFixed(2)}%</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-sm text-muted-foreground">Imbalance Ask:</span>
                        <Badge variant={"outline"}>{core.gate.imbalanceAskPercent?.toFixed(2)}%</Badge>
                    </div>
                </AccordionContent>
            </AccordionItem>
        );
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="w-[600px] !max-w-full p-0 outline-none">
                {/* khung tổng: header / body / footer */}
                <div className="flex h-full flex-col">
                    {/* Header */}
                    <SheetHeader className="px-4 pt-4 pb-2 border-b">
                        <SheetTitle>Whitelist {whitelistUi.length}</SheetTitle>
                    </SheetHeader>

                    {/* Body: chiếm hết, cho phép con co lại */}
                    <div className="flex-1 min-h-0 px-4 py-3 overflow-hidden">
                        {/* Grid 2 hàng, mỗi hàng 50% */}
                        <div className="grid grid-rows-2 gap-3 h-full">
                            {/* Pane 1: Qualified (50%) */}
                            <div className="min-h-0 flex flex-col rounded-md border">
                                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                                    <h3 className="text-sm font-semibold">Qualified</h3>
                                    <Badge variant="secondary">{qualifiedList.length}</Badge>
                                </div>

                                <div className="p-3 flex-1 overflow-y-scroll">
                                    {qualifiedList.length === 0 ? (
                                        <div className="text-xs text-muted-foreground">Chưa có symbol nào đạt điều kiện.</div>
                                    ) : (
                                        <Accordion type="multiple" className="space-y-2 w-full">
                                            {qualifiedList.map(renderItem)}
                                        </Accordion>
                                    )}
                                </div>
                            </div>

                            {/* Pane 2: All (50%) */}
                            <div className="min-h-0 flex flex-col rounded-md border">
                                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                                    <h3 className="text-sm font-semibold">All symbols</h3>
                                    <Badge variant="secondary">{allList.length}</Badge>
                                </div>

                                <div className="p-3 flex-1 overflow-y-scroll">
                                    {allList.length === 0 ? (
                                        <div className="text-xs text-muted-foreground">Không có dữ liệu.</div>
                                    ) : (
                                        <Accordion type="multiple" className="space-y-2 w-full">
                                            {allList.map(renderItem)}
                                        </Accordion>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <SheetFooter className="px-4 py-3 border-t">
                        <SheetClose asChild>
                            <Button variant="outline">Close</Button>
                        </SheetClose>
                    </SheetFooter>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// Unrealized PnL = (Mark Price - Entry Price) × Position Size × Contract Multiplier
// (13,299 - 13,385) * 1 * 0.1 = -0.0086
// Return % = (Unrealized PnL / Margin) × 100
// -0,0086 / 0,02 * 100 = -43%
