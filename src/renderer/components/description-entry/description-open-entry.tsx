import { useAppSelector } from "@/redux/store";

type TProps = {
    symbol: string;
    size: string;
    side: string;
    delay: number;
};
export default function DescriptionOpenEntry({ symbol, size, side, delay }: TProps) {
    const takeProfit = useAppSelector((state) => state.setting.settingBot?.takeProfit); // ví dụ: 0.5 (số)
    const stopLoss = useAppSelector((state) => state.setting.settingBot?.stopLoss);
    const timeoutMs = useAppSelector((state) => state.setting.settingBot?.timeoutMs);
    const timeoutEnabled = useAppSelector((state) => state.setting.settingBot?.timeoutEnabled);

    return (
        <div className="flex flex-col gap-0">
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Symbol:</p>
                <p className="font-bold">{symbol}</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Size:</p>
                <p className="font-bold">{size}</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Side:</p>
                <p className="font-bold">{side}</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">TP:</p>
                <p className="font-bold">{takeProfit}%</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">SL:</p>
                <p className="font-bold">{stopLoss}%</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Delay:</p>
                <p className="font-bold">{delay}ms</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Timeout ({timeoutEnabled ? `On` : `Off`}):</p>
                <p className="font-bold">{timeoutMs}ms</p>
            </div>
        </div>
    );
}
