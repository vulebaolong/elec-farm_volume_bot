import IconEmpty from "./IconEmty";

type TNodata = {
    width?: number;
    height?: number;
};

export default function Nodata({ width, height }: TNodata) {
    return (
        <div className="flex flex-col items-center justify-center gap-2">
            <IconEmpty width={width} height={height} />
            <p className="text-muted-foreground text-xs font-bold">No data</p>
        </div>
    );
}
