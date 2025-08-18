import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSocket } from "@/hooks/socket.hook";
import { SymbolState, TSymbols } from "@/types/symbol.type";
import { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { TSocketRes } from "@/types/base.type";
import { checkSize } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { cn } from "@/lib/utils";

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Symbols({ open, onOpenChange: setOpen }: TProps) {
    const socket = useSocket();
    const [symbols, setSymbols] = useState<SymbolState[]>([]);
    const settingUserId = useAppSelector((state) => state.user.info?.SettingUsers.id);

    useEffect(() => {
        if (!socket) return;

        const handleSymbols = (data: TSocketRes<TSymbols>) => {
            // console.log("symbols", data);

            const sortedSymbols = Object.values(data.data).sort((a, b) => a.symbol.localeCompare(b.symbol));

            setSymbols(sortedSymbols);
        };

        socket.socket?.on("symbols", handleSymbols);

        return () => {
            socket.socket?.off("symbols", handleSymbols);
        };
    }, [socket]);

    return (
        <>
            {settingUserId && (
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetContent className="w-[500px] !max-w-full gap-0">
                        <SheetHeader>
                            <SheetTitle>Symbol</SheetTitle>
                        </SheetHeader>
                        <div className="flex-1 h-auto w-full px-4 overflow-y-auto">
                            <Accordion type="multiple" className="space-y-2 w-full">
                                {symbols.map((item) => {
                                    const isQualified =
                                        item.flags?.isDepth &&
                                        item.flags?.isSpreadPercent &&
                                        // (item.flags.isLong || item.flags.isShort) &&
                                        checkSize(item.flags?.entryBySettingUserId?.[settingUserId]?.size);

                                    return (
                                        <AccordionItem
                                            key={item.symbol}
                                            value={item.symbol}
                                            className={cn(isQualified ? "border border-green-500 shadow-md rounded-md" : "", "border-b-0")}
                                        >
                                            <AccordionTrigger className="flex justify-between items-center px-4 py-2 rounded-md border shadow-sm bg-muted">
                                                <div className="flex items-center gap-1 text-xs font-medium">
                                                    <span>{item.symbol}</span>
                                                    <div className="flex gap-1">
                                                        <Badge
                                                            variant={
                                                                item.flags?.entryBySettingUserId?.[settingUserId]?.isLong ? "default" : "outline"
                                                            }
                                                            className={
                                                                item.flags?.entryBySettingUserId?.[settingUserId]?.isLong
                                                                    ? "bg-green-500 text-white"
                                                                    : ""
                                                            }
                                                        >
                                                            Long
                                                        </Badge>
                                                        <Badge
                                                            variant={
                                                                item.flags?.entryBySettingUserId?.[settingUserId]?.isShort ? "default" : "outline"
                                                            }
                                                            className={
                                                                item.flags?.entryBySettingUserId?.[settingUserId]?.isShort
                                                                    ? "bg-red-500 text-white"
                                                                    : ""
                                                            }
                                                        >
                                                            Short
                                                        </Badge>
                                                        <Badge variant={item.flags?.isDepth ? "default" : "outline"}>Depth</Badge>
                                                        <Badge variant={item.flags?.isSpreadPercent ? "default" : "outline"}>Spread</Badge>
                                                        <Badge
                                                            variant={
                                                                checkSize(item.flags?.entryBySettingUserId?.[settingUserId]?.size)
                                                                    ? "default"
                                                                    : "outline"
                                                            }
                                                        >
                                                            Size
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="bg-background px-4 py-2 text-sm space-y-1 rounded-md">
                                                <div className="text-sm text-muted-foreground">
                                                    <span>Last Price: </span>
                                                    <span className="font-medium text-foreground">{item.lastPrice}</span>
                                                </div>

                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-sm text-muted-foreground">Size:</span>
                                                    <Badge
                                                        variant={
                                                            checkSize(item.flags?.entryBySettingUserId?.[settingUserId]?.size) ? "default" : "outline"
                                                        }
                                                    >
                                                        {item.flags?.entryBySettingUserId?.[settingUserId]?.size}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-sm text-muted-foreground">Spread %:</span>
                                                    <Badge variant={item.flags?.isSpreadPercent ? "default" : "outline"}>
                                                        {item.spreadPercent?.toFixed(2)}%
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-sm text-muted-foreground">Bid USD:</span>
                                                    <Badge variant={"outline"}>{item.bidUSD}</Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-sm text-muted-foreground">Ask USD:</span>
                                                    <Badge variant={"outline"}>{item.askUSD}</Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-sm text-muted-foreground">Imbalance Bid:</span>
                                                    <Badge variant={"outline"}>{item.imbalanceBidPercent?.toFixed(2)}%</Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-sm text-muted-foreground">Imbalance Ask:</span>
                                                    <Badge variant={"outline"}>{item.imbalanceAskPercent?.toFixed(2)}%</Badge>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        </div>
                        <SheetFooter>
                            <SheetClose asChild>
                                <Button variant="outline">Close</Button>
                            </SheetClose>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            )}
        </>
    );
}

// Unrealized PnL = (Mark Price - Entry Price) × Position Size × Contract Multiplier
// (13,299 - 13,385) * 1 * 0.1 = -0.0086
// Return % = (Unrealized PnL / Margin) × 100
// -0,0086 / 0,02 * 100 = -43%
