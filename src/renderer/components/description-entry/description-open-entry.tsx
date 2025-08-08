type TProps = {
    symbol: string;
    side: string;
    tp: number;
    sl: number;
    delay: number;
    timeout: number;
};
export default function DescriptionOpenEntry({ symbol, side, tp, sl, delay, timeout }: TProps) {
    return (
        <div className="flex flex-col gap-0">
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Symbol:</p>
                <p className="font-bold">{symbol}</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Side:</p>
                <p className="font-bold">{side}</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">TP:</p>
                <p className="font-bold">{tp.toFixed(2)}%</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">SL:</p>
                <p className="font-bold">{sl.toFixed(2)}%</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Delay:</p>
                <p className="font-bold">{delay}ms</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Timeout:</p>
                <p className="font-bold">{timeout}ms</p>
            </div>
        </div>
    );
}
