type TProps = {
    symbol: string;
    reason: string;
    returnPercent?: number;
    tp: number;
    sl: number;
};
export default function DescriptionCloseEntry({ symbol, reason, returnPercent, tp, sl }: TProps) {
    return (
        <div className="flex flex-col gap-0">
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Symbol:</p>
                <p className="text-primary font-bold">{symbol}</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Reason:</p>
                <p className="text-primary font-bold">{reason}</p>
            </div>
            {returnPercent === undefined || returnPercent === null ? (
                <></>
            ) : (
                <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">ROI:</p>
                    <p className="text-primary font-bold">{returnPercent.toFixed(2)}%</p>
                </div>
            )}
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">TP:</p>
                <p className="text-primary font-bold">{tp.toFixed(2)}%</p>
            </div>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">SL:</p>
                <p className="text-primary font-bold">{sl.toFixed(2)}%</p>
            </div>
        </div>
    );
}
