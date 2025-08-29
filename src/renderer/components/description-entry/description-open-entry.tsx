type TProps = {
    symbol: string;
    size: string | number;
    price: string | number;
};
export default function DescriptionOpenEntry({ symbol, size, price }: TProps) {
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
                <p className="text-sm text-muted-foreground">Price:</p>
                <p className="font-bold">{price}</p>
            </div>
        </div>
    );
}
