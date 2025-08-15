// components/sentiment-bar.tsx
import { cn } from "@/lib/utils";
import * as React from "react";

type Props = {
    total: number;
    green: number; // số coin LONG
    red: number; // số coin SHORT
    thresholdLong?: number; // % mốc cho Long (trái -> phải)
    thresholdShort?: number; // % mốc cho Short (phải -> trái)
    className?: string;
    animMs?: number; // thời gian animation (ms)
};

// clamp helper
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export function SentimentBar({ total, green, red, thresholdLong = 70, thresholdShort = 70, animMs = 450,className }: Props) {
    const g = total ? (green / total) * 100 : 0; // %
    const r = total ? (red / total) * 100 : 0; // %
    let gW = clamp(Math.round(g));
    let rW = clamp(Math.round(r));

    // bảo đảm không chồng lên nhau (neutral = phần còn lại)
    if (gW + rW > 100) rW = 100 - gW;

    const markerStyleLong: React.CSSProperties = {
        left: `${clamp(thresholdLong)}%`,
        transition: `left ${animMs}ms ease-in-out`,
        willChange: "left",
    };
    const markerStyleShort: React.CSSProperties = {
        right: `${clamp(thresholdShort)}%`,
        transition: `right ${animMs}ms ease-in-out`,
        willChange: "right",
    };
    return (
        <div className={cn("relative h-3 w-full overflow-hidden rounded-full bg-muted", className)}>
            {/* nền xám = neutral (ở giữa) */}

            {/* LONG từ trái */}
            <div className="absolute left-0 top-0 h-full bg-emerald-500 rounded-l-full transition-[width] duration-300" style={{ width: `${gW}%` }} />

            {/* SHORT từ phải */}
            <div className="absolute right-0 top-0 h-full bg-red-500 rounded-r-full transition-[width] duration-300" style={{ width: `${rW}%` }} />

            {/* vạch mốc LONG (từ trái) */}
            <div
                className="absolute inset-y-0 w-[5px] bg-emerald-700 rounded-full border-[0.1px] border-white"
                style={markerStyleLong}
                aria-hidden
            />

            {/* vạch mốc SHORT (từ phải) */}
            <div
                className="absolute inset-y-0 w-[5px] bg-red-700 rounded-full border-[0.1px] border-white"
                style={markerStyleShort}
                aria-hidden
            />
        </div>
    );
}
