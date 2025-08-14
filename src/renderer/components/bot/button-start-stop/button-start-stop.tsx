import { Button } from "@/components/ui/button";
import { handleCloseAll } from "@/helpers/close-all-handler.helper";
import { SET_IS_START } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { toast } from "sonner";

type TProps = {
    isReady: boolean;
    webviewRef: React.RefObject<Electron.WebviewTag | null>;
};

export default function ButtonStartStop({ isReady, webviewRef }: TProps) {
    const isStart = useAppSelector((state) => state.bot.isStart);
    const dispatch = useAppDispatch();

    const start = () => {
        dispatch(SET_IS_START(true));
        console.log("[WS] Started listening to entry");
    };

    const stop = () => {
        dispatch(SET_IS_START(false));
        if (!webviewRef.current) {
            toast.warning(`Webview not found`);
            return;
        }
        const webview = webviewRef.current;
        handleCloseAll({ webview });
        console.log("[WS] Stopped listening to entry");
    };
    return (
        <div className="flex gap-2 items-center">
            <Button disabled={!isReady || isStart} onClick={start} size="sm">
                Start
            </Button>
            <Button disabled={!isReady || !isStart} onClick={stop} size="sm">
                Stop
            </Button>
        </div>
    );
}
