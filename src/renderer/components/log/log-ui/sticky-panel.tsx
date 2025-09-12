import { useStickies } from "@/helpers/timeout-sticky-store";

export function StickyPanel() {
    const stickies = useStickies();
    return (
        <ul className="font-mono text-xs">
            {stickies.map((s) => (
                <li key={s.key}>{s.text}</li>
            ))}
        </ul>
    );
}
