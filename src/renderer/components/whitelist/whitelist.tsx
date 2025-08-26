import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/store";
import { TSide } from "@/types/base.type";
import { TPriority } from "@/types/priority-change.type";
import { TWhiteList, TWhiteListItem } from "@/types/white-list.type";
import { Bot } from "../bot/logic/class-bot";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Button } from "../ui/button";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
    whitelist?: TWhiteList;
    totalWhitelist: number;
    priority: "long" | "short" | "normal";
};

export default function Whitelist({ priority, whitelist, open, onOpenChange: setOpen, totalWhitelist }: TProps) {
    const settingUser = useAppSelector((state) => state.user.info?.SettingUsers);

    // -------- core helpers: match setWhitelistEntry semantics --------
    const isDepth = (askSumDepth: number, bidSumDepth: number): boolean => {
        if (!settingUser) return false;
        return bidSumDepth >= settingUser.maxDepth || askSumDepth >= settingUser.maxDepth;
    };

    const isSpreadPercent = (spreadPercent: number): boolean => {
        if (!settingUser) return false;
        const minSpreadPercent = settingUser.minSpreadPercent;
        const maxSpreadPercent = settingUser.maxSpreadPercent;
        if (spreadPercent == null || Number.isNaN(spreadPercent)) return false;
        return spreadPercent >= minSpreadPercent && spreadPercent <= maxSpreadPercent; // Spread 0.05% – 0.20%
    };

    const calcSize = (inputUSDT: number, price: number, multiplier: number, minSize = 1, maxSize?: number, step = 1) => {
        if (!(price > 0) || !(multiplier > 0)) return 0;
        let size = Math.floor(inputUSDT / price / multiplier / step) * step;
        if (size < minSize) return 0; // giữ nguyên hành vi: nếu < minSize thì bỏ
        if (maxSize != null) size = Math.min(size, maxSize);
        return size;
    };

    const handleSize = (whitelistItem: TWhiteListItem): string => {
        if (!settingUser) return "0";

        const { order_size_min, order_size_max, quanto_multiplier, symbol } = whitelistItem.contractInfo;
        const { lastPrice } = whitelistItem.core;
        const inputUSDT = settingUser.inputUSDT;

        if ([order_size_min, order_size_max, quanto_multiplier, inputUSDT, lastPrice].some((v) => v == null)) {
            console.log(`${symbol} - Tham số không hợp lệ: `, { order_size_min, order_size_max, quanto_multiplier, inputUSDT, lastPrice });
            return "0";
        }

        if (lastPrice == null || Number.isNaN(lastPrice)) {
            console.log(`${symbol} - Giá không hợp lệ: `, lastPrice);
            return "0";
        }

        const size = calcSize(
            Number(inputUSDT),
            Number(lastPrice),
            Number(quanto_multiplier),
            Number(order_size_min) || 1,
            Number(order_size_max),
            Number(order_size_min) || 1,
        );

        if (size == null || Number.isNaN(size)) {
            console.log(`${symbol} - Size không hợp lệ: `, size);
            return "0";
        }

        return size.toString();
    };

    const isLong = (imbalanceBidPercent: number) => {
        if (!settingUser) return false;
        return imbalanceBidPercent > settingUser.ifImbalanceBidPercent;
    };

    const isShort = (imbalanceAskPercent: number) => {
        if (!settingUser) return false;
        return imbalanceAskPercent > settingUser.ifImbalanceAskPercent;
    };

    const pickSideByPriority = (isLongOk: boolean, isShortOk: boolean, p: TPriority): TSide | null => {
        switch (p) {
            case "long":
                return isLongOk ? "long" : null;
            case "short":
                return isShortOk ? "short" : null;
            case "normal":
                if (isLongOk && !isShortOk) return "long";
                if (!isLongOk && isShortOk) return "short";
                if (isLongOk && isShortOk) return "long"; // ưu tiên long nếu cả 2 đều thoả
                return null;
            default:
                return null;
        }
    };

    // -------- derive + sort so qualified entries go first --------
    const deriveAndSort = (wl: TWhiteList) => {
        const list = Object.values(wl).map((item) => {
            const spreadOk = isSpreadPercent(item.core.spreadPercent);
            const depthOk = isDepth(item.core.askSumDepth, item.core.bidSumDepth);
            const sizeStr = handleSize(item);
            const sizeOk = Bot.checkSize(sizeStr);
            const side = pickSideByPriority(isLong(item.core.imbalanceBidPercent), isShort(item.core.imbalanceAskPercent), priority);
            const qualified = spreadOk && depthOk && sizeOk && !!side;
            return { item, spreadOk, depthOk, sizeStr, sizeOk, side, qualified };
        });

        return list.sort((a, b) => Number(b.qualified) - Number(a.qualified));
    };

    return (
        <>
            {settingUser && whitelist && (
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetContent className="w-[600px] !max-w-full gap-0 outline-none">
                        <SheetHeader>
                            <SheetTitle>Whitelist {totalWhitelist}</SheetTitle>
                        </SheetHeader>
                        <div className="flex-1 h-auto w-full px-4 overflow-y-auto">
                            <Accordion type="multiple" className="space-y-2 w-full">
                                {deriveAndSort(whitelist).map(({ item, spreadOk, depthOk, sizeStr, sizeOk, side, qualified }) => (
                                    <AccordionItem
                                        key={item.core.symbol}
                                        value={item.core.symbol}
                                        className={cn(qualified ? "border border-green-500 shadow-md rounded-md" : "border-0")}
                                    >
                                        <AccordionTrigger className="flex justify-between items-center px-4 py-2 rounded-md border shadow-sm bg-muted">
                                            <div className="flex items-center gap-1 text-xs font-medium">
                                                <span>{item.core.symbol}</span>
                                                <div className="flex gap-1">
                                                    <Badge
                                                        variant={isLong(item.core.imbalanceBidPercent) ? "default" : "outline"}
                                                        className={isLong(item.core.imbalanceBidPercent) ? "bg-green-500 text-white" : ""}
                                                    >
                                                        Long
                                                    </Badge>
                                                    <Badge
                                                        variant={isShort(item.core.imbalanceAskPercent) ? "default" : "outline"}
                                                        className={isShort(item.core.imbalanceAskPercent) ? "bg-red-500 text-white" : ""}
                                                    >
                                                        Short
                                                    </Badge>
                                                    <Badge variant={depthOk ? "default" : "outline"}>Depth</Badge>
                                                    <Badge variant={spreadOk ? "default" : "outline"}>Spread</Badge>
                                                    <Badge variant={sizeOk ? "default" : "outline"}>Size</Badge>
                                                    <Badge variant={side ? "default" : "outline"}>Priority</Badge>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="bg-background px-4 py-2 text-sm space-y-1 rounded-md">
                                            <div className="text-sm text-muted-foreground">
                                                <span>Last Price: </span>
                                                <span className="font-medium text-foreground">{item.core.lastPrice}</span>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Size:</span>
                                                <Badge variant={sizeOk ? "default" : "outline"}>{sizeStr}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Spread %:</span>
                                                <Badge variant={spreadOk ? "default" : "outline"}>{item.core.spreadPercent?.toFixed(2)}%</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Bid USD:</span>
                                                <Badge variant={"outline"}>{item.core.bidSumDepth}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Ask USD:</span>
                                                <Badge variant={"outline"}>{item.core.askSumDepth}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Imbalance Bid:</span>
                                                <Badge variant={"outline"}>{item.core.imbalanceBidPercent?.toFixed(2)}%</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-sm text-muted-foreground">Imbalance Ask:</span>
                                                <Badge variant={"outline"}>{item.core.imbalanceAskPercent?.toFixed(2)}%</Badge>
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
