import Nodata from "./Nodata";

type TProps = {
    visible?: boolean | undefined;
    width?: number;
    height?: number;
};

export default function NodataOverlay({ visible, width, height }: TProps) {
    if (!visible) return <></>;

    return (
        <div className="absolute top-0 left-0 right-0 bottom-0 z-10 flex items-center justify-center backdrop-blur-sm">
            <Nodata width={width} height={height} />
        </div>
    );
}
