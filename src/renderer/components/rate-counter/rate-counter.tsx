import { useEffect, useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TWorkerData } from "@/types/worker.type";
import type { WindowKey } from "src/main/workers/bot.worker";
import { NumberInput } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const ORDER: WindowKey[] = ["1s", "1m", "5m", "15m", "30m", "1h"];
const LS_KEY = "rateCounter:max";

function shallowEqualCounts(currentCounts: Record<WindowKey, number>, nextCounts: Record<WindowKey, number>) {
    for (const windowKey of ORDER) if ((currentCounts[windowKey] ?? 0) !== (nextCounts[windowKey] ?? 0)) return false;
    return true;
}

function loadMax(): Record<WindowKey, number> {
    try {
        const stored = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
        const result = {} as Record<WindowKey, number>;
        ORDER.forEach((windowKey) => {
            const parsed = Number(stored?.[windowKey]);
            result[windowKey] = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        });
        return result;
    } catch {
        return { "1s": 0, "1m": 0, "5m": 0, "15m": 0, "30m": 0, "1h": 0 };
    }
}

function saveMax(maxByWindow: Record<WindowKey, number>) {
    localStorage.setItem(LS_KEY, JSON.stringify(maxByWindow));
}

function sendMaxToWorker(payload: Record<WindowKey, number>) {
    window.electron.ipcRenderer.sendMessage("bot:rateMax:set", payload);
}

export default function RateCounter({ className }: { className?: string }) {
    const [counts, setCounts] = useState<Record<WindowKey, number>>({
        "1s": 0,
        "1m": 0,
        "5m": 0,
        "15m": 0,
        "30m": 0,
        "1h": 0,
    });
    const [max, setMax] = useState<Record<WindowKey, number>>(() => loadMax());
    const [lastUpdatedTs, setLastUpdatedTs] = useState<number>(Date.now());

    useEffect(() => {
        // gửi ngưỡng hiện tại ngay khi component mount (đồng bộ worker sau reload UI)
        sendMaxToWorker(loadMax());
    }, []);

    useEffect(() => {
        const offRateCounter = window.electron.ipcRenderer.on("bot:rateCounter", (data: TWorkerData<Record<WindowKey, number>>) => {
            const incomingCounts = data?.payload ?? counts;
            if (!shallowEqualCounts(counts, incomingCounts)) {
                setCounts(incomingCounts);
                setLastUpdatedTs(Date.now());
            }
        });
        return () => {
            offRateCounter?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [counts]);

    const rows = useMemo(
        () =>
            ORDER.map((windowKey) => {
                const currentValue = counts[windowKey] ?? 0;
                const maxValue = max[windowKey] ?? 0;
                const isOverLimit = maxValue > 0 && currentValue > maxValue; // chỉ tô màu số hiện tại nếu vượt ngưỡng (không hiệu ứng)
                return (
                    <div key={windowKey} className="flex items-center py-0.5">
                        {/* nhãn */}
                        <div className="w-10 shrink-0 text-[12px] text-muted-foreground">{windowKey}</div>

                        {/* currentValue / input */}
                        <div className="flex items-center gap-2 font-mono tabular-nums text-[12px]">
                            <span className={cn(isOverLimit ? "text-red-600" : "text-foreground")}>{currentValue}</span>
                            <span className="opacity-60">/</span>

                            <NumberInput
                                size="xs"
                                value={maxValue}
                                onChange={(inputValue) => {
                                    const normalized = Math.max(0, Number(inputValue ?? 0));
                                    const updatedMax = { ...max, [windowKey]: Number.isFinite(normalized) ? normalized : 0 };
                                    setMax(updatedMax);
                                    saveMax(updatedMax);
                                    sendMaxToWorker(updatedMax);
                                }}
                                min={0}
                                step={1}
                                hideControls
                                clampBehavior="strict"
                                inputMode="numeric"
                                className="w-20"
                                thousandSeparator
                                // variant="unstyled"
                                placeholder="0"
                            />
                        </div>
                    </div>
                );
            }),
        [counts, max],
    );

    return (
        <Card className={cn("flex flex-col gap-1 text-xs", className)}>
          
            <CardHeader className="flex items-center gap-2">
                <CardTitle className="text-base">Rate limits</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-0">
                {/* danh sách dọc: 1s  0 / [100] */}
                <div className="flex flex-col">{rows}</div>

                <TooltipProvider>
                    <div className="flex items-center gap-2">
                        {/* Nút chấm than: giải thích rate limit cho người dùng cuối */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full
                     text-amber-600/90 dark:text-amber-400/90
                     hover:text-amber-600 dark:hover:text-amber-300 focus:outline-none"
                                    aria-label="Giải thích giới hạn tốc độ gọi lệnh"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[420px] text-xs leading-relaxed">
                                <div className="space-y-2">
                                    <div className="font-medium">Giới hạn tốc độ gọi lệnh là gì?</div>

                                    <div>
                                        Mỗi hàng tương ứng với một <b>khoảng thời gian gần đây</b>:<span className="mx-1">1s</span>(1 giây),
                                        <span className="mx-1">1m</span>(1 phút),
                                        <span className="mx-1">5m</span>, <span className="mx-1">15m</span>, <span className="mx-1">30m</span>,{" "}
                                        <span className="mx-1">1h</span>.
                                    </div>

                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>
                                            Số <b>bên trái</b> cho biết <b>đã gửi bao nhiêu lệnh</b> trong khoảng thời gian đó (tính đến thời điểm
                                            hiện tại).
                                        </li>
                                        <li>
                                            Số <b>bên phải</b> là <b>mức trần</b> bạn đặt. Để <b>0</b> nghĩa là <b>không giới hạn</b>.
                                        </li>
                                        <li>
                                            Khi <b>số bên trái ≥ số bên phải</b>, số sẽ hiển thị <b>màu đỏ</b> và hệ thống sẽ
                                            <b> tạm dừng mở lệnh mới</b> để an toàn.
                                        </li>
                                        <li>
                                            Các lệnh <b>quá cũ</b> sẽ tự động <b>không còn được tính</b> sau khi hết khoảng thời gian tương ứng, nên
                                            con số có thể <b>giảm xuống dần theo thời gian</b>.
                                        </li>
                                    </ul>

                                    <div className="text-[11px] opacity-80">
                                        Ví dụ: Hàng <b>5m</b> = <b>101 / 100</b> nghĩa là trong <b>5 phút gần đây</b> đã có 101 lệnh, vượt mức bạn cho
                                        phép là 100 lệnh.
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>

                        {/* “updated …” như cũ (đổi lastUpdatedAt thành state bạn đang dùng) */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="text-[11px] text-muted-foreground cursor-default select-none w-fit">
                                    updated {new Date(lastUpdatedTs).toLocaleTimeString()}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs">Last update: {new Date(lastUpdatedTs).toLocaleString()}</div>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
}
