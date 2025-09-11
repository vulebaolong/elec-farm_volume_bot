import { useEffect, useState } from "react";
import TerminalLog, { LogLine } from "./terminal-log";

export default function LogsPane() {
    const [lines, setLines] = useState<LogLine[]>([]);

    useEffect(() => {
        const off = window.electron.ipcRenderer.on("bot:log", (l: LogLine) => {
            setLines((prev) => [...prev, l]);
        });
        const onClear = () => setLines([]);
        window.addEventListener("terminal:clear", onClear);
        return () => {
            off?.();
            window.removeEventListener("terminal:clear", onClear);
        };
    }, []);

    return <TerminalLog lines={lines} className="!p-2 w-[500px]" maxLines={1000} />;
}
