import { Button } from "@/components/ui/button";
import { SET_IS_START } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";

type TProps = {
    isReady: boolean;
};

export default function ButtonStartStop({ isReady }: TProps) {
    const isStart = useAppSelector((state) => state.bot.isStart);
    const dispatch = useAppDispatch();

    const startListening = () => {
        dispatch(SET_IS_START(true));
        console.log("[WS] Started listening to entry");
    };

    const stopListening = () => {
        dispatch(SET_IS_START(false));
        console.log("[WS] Stopped listening to entry");
    };
    return (
        <div className="flex gap-2 items-center">
            <Button disabled={!isReady || isStart} onClick={startListening} size="sm">
                Start
            </Button>
            <Button disabled={!isReady || !isStart} onClick={stopListening} size="sm">
                Stop
            </Button>
        </div>
    );
}
