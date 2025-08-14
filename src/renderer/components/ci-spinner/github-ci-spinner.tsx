// components/github-ci-spinner.tsx
import * as React from "react";

type SpinnerState = "start" | "pause" | "stop";
type StopVisual = "dot" | "ring"; // NEW: cách hiển thị khi stop

type Props = {
    size?: number; // px
    color?: string; // màu khi start/pause
    stopColor?: string; // màu khi stop (xám tối)
    speedMs?: number; // tốc độ quay
    segmentRatio?: number; // 0.25–0.6 (độ dài cung sáng)
    thicknessRatio?: number; // 0.12–0.35 (độ dày viền)
    gapRatio?: number; // 0.05–0.2  (khoảng hở dot-ring)
    state?: SpinnerState; // start | pause | stop
    pauseDim?: number; // 0.5–0.95 (độ tối khi pause)
    stopVisual?: StopVisual; // NEW: 'dot' (default) hoặc 'ring'
    className?: string;
    label?: string;
};

export function GithubCiSpinner({
    size = 24,
    color = "#f59e0b",
    stopColor = "#52525b", // zinc-600
    speedMs = 1000,
    segmentRatio = 0.38,
    thicknessRatio = 0.24,
    gapRatio = 0.12,
    state = "start",
    pauseDim = 0.75,
    stopVisual = "dot",
    className,
    label = "Status",
}: Props) {
    // ViewBox chuẩn hoá tỉ lệ
    const CX = 50,
        CY = 50;
    const R = 42;
    const sw = R * thicknessRatio;
    const C = 2 * Math.PI * R;
    const arc = Math.max(6, C * segmentRatio);
    const gap = C - arc;
    const dotR = Math.max(0, R - sw / 2 - R * gapRatio);

    const running = state === "start";
    const isPause = state === "pause";
    const isStop = state === "stop";

    const baseColor = isStop ? stopColor : color;

    return (
        <span className={className} role="status" aria-label={label} style={{ ["--ci" as any]: baseColor }}>
            <svg
                viewBox="0 0 100 100"
                width={size}
                height={size}
                fill="none"
                // chỉ áp filter khi pause
                style={isPause ? { filter: `brightness(${pauseDim}) saturate(85%)` } : undefined}
            >
                {/* --- START / PAUSE: ring + wedge + dot --- */}
                {!isStop && (
                    <>
                        {/* track mờ */}
                        <circle cx={CX} cy={CY} r={R} stroke="var(--ci)" strokeOpacity={0.22} strokeWidth={sw} />
                        {/* wedge quay (paused ở pause) */}
                        <g
                            style={{
                                animation: `gh-spin ${speedMs}ms linear infinite`,
                                animationPlayState: running ? "running" : "paused",
                                transformOrigin: "50% 50%",
                                transformBox: "fill-box" as any,
                            }}
                        >
                            <circle
                                cx={CX}
                                cy={CY}
                                r={R}
                                stroke="var(--ci)"
                                strokeWidth={sw}
                                strokeLinecap="round"
                                strokeDasharray={`${arc} ${gap}`}
                                strokeDashoffset={0}
                            />
                        </g>
                        {/* dot giữa */}
                        <circle cx={CX} cy={CY} r={dotR} fill="var(--ci)" />
                    </>
                )}

                {/* --- STOP: không còn wedge --- */}
                {isStop &&
                    (stopVisual === "dot" ? (
                        // Chỉ hiển thị dot (đồng nhất, không ring/wedge)
                        <circle cx={CX} cy={CY} r={dotR} fill="var(--ci)" />
                    ) : (
                        // Hoặc hiển thị ring tĩnh đồng màu
                        <>
                            <circle cx={CX} cy={CY} r={R} stroke="var(--ci)" strokeWidth={sw} />
                            <circle cx={CX} cy={CY} r={dotR} fill="var(--ci)" />
                        </>
                    ))}
            </svg>

            <style>{`@keyframes gh-spin { to { transform: rotate(360deg); } }`}</style>
            <span className="sr-only">{label}</span>
        </span>
    );
}
