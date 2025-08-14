import { useAppSelector } from "@/redux/store";

type TProps = {
    symbol: string;
    size: string;
    side: string;
    delay: number;
};
export default function DescriptionOpenEntry({ symbol, size, side, delay }: TProps) {
    const takeProfit = useAppSelector((state) => state.user.info?.SettingUsers.takeProfit); // ví dụ: 0.5 (số)
    const stopLoss = useAppSelector((state) => state.user.info?.SettingUsers.stopLoss);
    const timeoutMs = useAppSelector((state) => state.user.info?.SettingUsers.timeoutMs);
    const timeoutEnabled = useAppSelector((state) => state.user.info?.SettingUsers.timeoutEnabled);

    return (
        <div className="flex flex-col gap-0">
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Symbol:</p>
                <p className="text-primary font-bold">{symbol}</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Size:</p>
                <p className="text-primary font-bold">{size}</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Side:</p>
                <p className="text-primary font-bold">{side}</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">TP:</p>
                <p className="text-primary font-bold">{takeProfit}%</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">SL:</p>
                <p className="text-primary font-bold">{stopLoss}%</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Delay:</p>
                <p className="text-primary font-bold">{delay}ms</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Timeout ({timeoutEnabled ? `On` : `Off`}):</p>
                <p className="text-primary font-bold">{timeoutMs}ms</p>
            </div>
        </div>
    );
}
