import { Badge } from "@/components/ui/badge";
import { useSocket } from "@/hooks/socket.hook";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/store";
import { TSocketRes } from "@/types/base.type";
import { TWhiteList, TWhitelistUi } from "@/types/white-list.type";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { checkSize, handleSize, isDepthCalc, isSpreadPercent } from "../bot/logic/handle-bot";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Button } from "../ui/button";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Whitelist({ open, onOpenChange }: TProps) {
    const socket = useSocket();
    const settingUser = useAppSelector((state) => state.user.info?.SettingUsers);
    const [whitelistUi, setWhitelistUi] = useState<TWhitelistUi[]>([]);

    useEffect(() => {
        if (!socket?.socket || !settingUser) return;
        const io = socket.socket; // ✅ bắt giữ instance

        const handleEntry = ({ data }: TSocketRes<TWhiteList>) => {
            const whiteListArr = Object.values(data);

            const result: TWhitelistUi[] = [];

            for (const whitelistItem of whiteListArr) {
                const { core, contractInfo } = whitelistItem;
                const { askBest, askSumDepth, bidBest, bidSumDepth, imbalanceAskPercent, imbalanceBidPercent, lastPrice, spreadPercent, symbol } =
                    core ?? {};

                const { order_price_round } = contractInfo;

                const missing =
                    !symbol ||
                    spreadPercent == null ||
                    bidSumDepth == null ||
                    askSumDepth == null ||
                    lastPrice == null ||
                    imbalanceAskPercent == null ||
                    imbalanceBidPercent == null ||
                    order_price_round == null;

                if (missing) {
                    toast.error(`[${symbol ?? "UNKNOWN"}] core thiếu field: ${JSON.stringify(core)}`, { duration: Infinity });
                    continue;
                }

                const isSpread = isSpreadPercent(spreadPercent, settingUser.minSpreadPercent, settingUser.maxSpreadPercent);
                const isDepth = isDepthCalc(askSumDepth, bidSumDepth, settingUser.maxDepth);

                const sizeStr = handleSize(whitelistItem, settingUser.inputUSDT);
                const isSize = checkSize(sizeStr);

                const isLong = imbalanceBidPercent > settingUser.ifImbalanceBidPercent;
                const isShort = imbalanceAskPercent > settingUser.ifImbalanceAskPercent;
                const side = isLong ? "long" : isShort ? "short" : null;

                const qualified = isSpread && isDepth && isSize && !!side;

                result.push({
                    core,
                    isDepth,
                    isLong,
                    isShort,
                    isSize,
                    isSpread,
                    qualified,
                    sizeStr,
                    side,
                    symbol,
                });
            }

            setWhitelistUi(result);
        };

        io.on("entry", handleEntry);

        return () => {
            io.off("entry", handleEntry);
        };
    }, [socket?.socket, settingUser]);

    return (
        <>
            {whitelistUi && (
                <Sheet open={open} onOpenChange={onOpenChange}>
                    <SheetContent className="w-[600px] !max-w-full gap-0 outline-none">
                        <SheetHeader>
                            <SheetTitle>Whitelist {whitelistUi.length}</SheetTitle>
                        </SheetHeader>
                        <div className="flex-1 h-auto w-full px-4 overflow-y-auto">
                            <Accordion type="multiple" className="space-y-2 w-full">
                                {whitelistUi.map(({ core, isSpread, isDepth, sizeStr, isSize, qualified, isLong, isShort }) => (
                                    <AccordionItem
                                        key={core.symbol}
                                        value={core.symbol}
                                        className={cn(qualified ? "border border-green-500 shadow-md rounded-md" : "border-0")}
                                    >
                                        <AccordionTrigger className="flex justify-between items-center px-4 py-2 rounded-md border shadow-sm bg-muted">
                                            <div className="flex items-center gap-1 text-xs font-medium">
                                                <span>{core.symbol}</span>
                                                <div className="flex gap-1">
                                                    <Badge
                                                        variant={isLong ? "default" : "outline"}
                                                        className={isLong ? "bg-green-500 text-white" : ""}
                                                    >
                                                        Long
                                                    </Badge>
                                                    <Badge
                                                        variant={isShort ? "default" : "outline"}
                                                        className={isShort ? "bg-red-500 text-white" : ""}
                                                    >
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
                                                <span>Last Price: </span>
                                                <span className="font-medium text-foreground">{core.lastPrice}</span>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Size:</span>
                                                <Badge variant={isSize ? "default" : "outline"}>{sizeStr}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Spread %:</span>
                                                <Badge variant={isSpread ? "default" : "outline"}>{core.spreadPercent?.toFixed(2)}%</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Bid USD:</span>
                                                <Badge variant={"outline"}>{core.bidSumDepth}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Ask USD:</span>
                                                <Badge variant={"outline"}>{core.askSumDepth}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Imbalance Bid:</span>
                                                <Badge variant={"outline"}>{core.imbalanceBidPercent?.toFixed(2)}%</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Imbalance Ask:</span>
                                                <Badge variant={"outline"}>{core.imbalanceAskPercent?.toFixed(2)}%</Badge>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
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
