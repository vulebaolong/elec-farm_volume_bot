import { cn } from "@/lib/utils";
import { REMOVE_RIPPLE } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";

export default function Ripple() {
    const ripples = useAppSelector((s) => s.bot.ripples);
    const isRunning = useAppSelector((s) => s.bot.isRunning);
    const dispatch = useAppDispatch();

    const durationMs = 600; // phải khớp với keyframes/animation duration

    return (
        <div className="relative grid place-items-center w-[14px] h-[14px]">
            {/* halo luôn bật (đặc biệt rõ ở dark) */}
            <span
                className="
        pointer-events-none absolute -inset-1 rounded-full
        bg-emerald-400/25 blur-[4px]
        dark:bg-emerald-300/40 dark:blur-[10px]
      "
            />

            {/* dot trung tâm + glow */}
            <span
                className={cn(
                    "relative w-[10px] h-[10px] rounded-full",
                    isRunning ? "bg-emerald-400" : "bg-emerald-500",
                    // viền nhẹ + glow
                    "shadow-[inset_0_0_0_1px_rgba(255,255,255,.15)]",
                    // "drop-shadow-[0_0_4px_rgba(16,185,129,.60)]",
                    "dark:drop-shadow-[0_0_12px_rgba(16,185,129,.95)]",
                )}
            />

            {/* các ripple */}
            {ripples.map((id) => (
                <span
                    key={id}
                    className="
          pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          rounded-full
          bg-emerald-500/60 dark:bg-emerald-300/90
          ring-1 ring-emerald-300 dark:ring-emerald-100
          drop-shadow-[0_0_14px_rgba(16,185,129,.80)]
          animate-[pulseOnce_var(--dur)_ease-out_forwards]
        "
                    style={{ width: 22, height: 22, ["--dur" as any]: `${durationMs}ms` }}
                    onAnimationEnd={() => dispatch(REMOVE_RIPPLE(id))}
                />
            ))}
        </div>
    );
}
