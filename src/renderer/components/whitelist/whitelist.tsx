import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TWhitelistUi } from "@/types/white-list.type";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Button } from "../ui/button";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
    whitelistUi?: TWhitelistUi[];
    totalWhitelist: number;
};

export default function Whitelist({ whitelistUi, open, onOpenChange: setOpen, totalWhitelist }: TProps) {
    // const socket = useSocket();

    // useEffect(() => {
    //     if (!socket?.socket) return;
    //     const io = socket.socket; // ✅ bắt giữ instance

    //     const handleEntry = ({ data }: TSocketRes<TWhiteList>) => {
    //         console.log({ handleEntry: data });
    //     };

    //     io.on("entry", handleEntry);

    //     return () => {
    //         io.off("entry", handleEntry);
    //     };
    // }, [socket?.socket]);

    return (
        <>
            {whitelistUi && (
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetContent className="w-[600px] !max-w-full gap-0 outline-none">
                        <SheetHeader>
                            <SheetTitle>Whitelist {totalWhitelist}</SheetTitle>
                        </SheetHeader>
                        <div className="flex-1 h-auto w-full px-4 overflow-y-auto">
                            <Accordion type="multiple" className="space-y-2 w-full">
                                {whitelistUi.map(({ core, isSpread, isDepth, sizeStr, isSize, side, qualified, isLong, isShort }) => (
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
                                                    <Badge variant={side ? "default" : "outline"}>Priority</Badge>
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
