import { cn } from "@/lib/utils";
import { REMOVE_RIPPLE } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";

export default function Ripple() {
    const ripples = useAppSelector((s) => s.bot.ripples);
    const isRunning = useAppSelector((s) => s.bot.isRunning);
    const dispatch = useAppDispatch();

    const durationMs = 600; // phải khớp với keyframes/animation duration

    return (
        <div className={cn("relative rounded-full w-[10px] h-[10px]", isRunning ? "bg-green-400" : "bg-green-500")}>
            {ripples.map((id) => (
                <span
                    key={id}
                    // vòng tròn ripple
                    className="
            absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
            rounded-full bg-green-500/60
            animate-[pulseOnce_0.6s_ease-out_forwards]
            w-[20px] h-[20px]
          "
                    style={{ animationDuration: `${durationMs}ms` }}
                    onAnimationEnd={() => dispatch(REMOVE_RIPPLE(id))}
                />
            ))}
        </div>
    );
}
