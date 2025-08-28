// components/whitelist-sentiment.tsx
import Loadder from "@/components/loadder/loadder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { SentimentBar } from "./sentiment-bar";
import { useEffect, useState } from "react";
import { useAppDispatch } from "@/redux/store";
import { SET_PRIORITY } from "@/redux/slices/bot.slice";
import Whitelist from "@/components/whitelist/whitelist";
import { Bot } from "@/components/bot/logic/class-bot";
import { TWhitelistUi } from "@/types/white-list.type";

type Props = {
    total?: number;
    green?: number; // số coin “xanh”
    red?: number; // số coin “đỏ”
    thresholdLong?: number;
    thresholdShort?: number;
    lastUpdated?: string;
    isLoading?: boolean;
    botRef: React.RefObject<Bot | null>;
    whitelistUi: TWhitelistUi[]
};

export function WhitelistSentiment({
    whitelistUi,
    total = 100,
    green = 0,
    red = 0,
    thresholdLong = 70,
    thresholdShort = 70,
    lastUpdated,
    isLoading,
}: Props) {
    const dispatch = useAppDispatch();
    const [openWhitelist, setOpenWhitelist] = useState(false);

    const g = total ? Math.round((green / total) * 100) : 0;
    const r = total ? Math.round((red / total) * 100) : 0;
    const n = Math.max(0, 100 - g - r);

    const priority = g >= thresholdLong ? ("long" as const) : r >= thresholdShort ? ("short" as const) : ("normal" as const);

    useEffect(() => {
        dispatch(SET_PRIORITY(priority));
    }, [priority]);

    const PriorityIcon = priority === "long" ? TrendingUp : priority === "short" ? TrendingDown : Minus;

    const priorityBadge =
        priority === "long"
            ? "bg-emerald-600/15 text-emerald-500 border-emerald-600/30"
            : priority === "short"
              ? "bg-red-600/15 text-red-500 border-red-600/30"
              : "bg-muted text-muted-foreground";

    return (
        <>
            <Card>
                <CardHeader className="flex items-center gap-2">
                    <CardTitle className="text-base">Priority 24h Change</CardTitle>
                    {isLoading && <Loadder />}
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Stacked bar + threshold marker */}
                    <SentimentBar
                        className="h-3"
                        total={total}
                        green={green}
                        red={red}
                        thresholdLong={thresholdLong}
                        thresholdShort={thresholdShort}
                    />

                    {/* Chips */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge
                            onClick={() => {
                                setOpenWhitelist(true);
                            }}
                            variant="secondary"
                            className="gap-1 cursor-pointer"
                        >
                            Total Whitelist <Separator orientation="vertical" className="mx-1 h-4" />
                            <span className="font-medium">{total}</span>
                        </Badge>
                        <Badge className="gap-1 bg-emerald-600/15 text-emerald-500 border-emerald-600/30" variant="outline">
                            Green (Long) <Separator orientation="vertical" className="mx-1 h-4" />
                            <span className="font-medium">{g}%</span>
                        </Badge>
                        <Badge className="gap-1 bg-red-600/15 text-red-500 border-red-600/30" variant="outline">
                            Red (Short) <Separator orientation="vertical" className="mx-1 h-4" />
                            <span className="font-medium">{r}%</span>
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                            Neutral <Separator orientation="vertical" className="mx-1 h-4" />
                            <span className="font-medium">{n}%</span>
                        </Badge>
                        <div className="ml-auto flex gap-2">
                            <Badge variant="outline" className="gap-1">
                                Long Threshold <Separator orientation="vertical" className="mx-1 h-4" />
                                <span className="font-medium">{thresholdLong}%</span>
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                                Short Threshold <Separator orientation="vertical" className="mx-1 h-4" />
                                <span className="font-medium">{thresholdShort}%</span>
                            </Badge>
                        </div>
                    </div>

                    {/* Rule banner */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <PriorityIcon className="size-4" />
                            <span className="font-semibold">Priority</span>
                            <Badge className={priorityBadge} variant="outline">
                                {priority === "long"
                                    ? `LONG (≥ ${thresholdLong}% green)`
                                    : priority === "short"
                                      ? `SHORT (≥ ${thresholdShort}% red)`
                                      : "NORMAL"}
                            </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Rule: ≥{thresholdLong}% green ⇒ Priority LONG · ≥{thresholdShort}% red ⇒ Priority SHORT
                        </div>
                    </div>

                    {lastUpdated && <div className="text-xs text-muted-foreground">Last updated: {lastUpdated}</div>}
                </CardContent>
            </Card>
            <Whitelist
                totalWhitelist={total}
                whitelistUi={whitelistUi}
                open={openWhitelist}
                onOpenChange={setOpenWhitelist}
            />
        </>
    );
}
