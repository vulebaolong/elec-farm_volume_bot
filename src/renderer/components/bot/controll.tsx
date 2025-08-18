import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { handleCloseAll } from "@/helpers/close-all-handler.helper";
import { SET_IS_START } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { toast } from "sonner";

type TProps = {
    isReady: boolean;
    webviewRef: React.RefObject<Electron.WebviewTag | null>;
};

export default function Controll({ isReady, webviewRef }: TProps) {
    const isStart = useAppSelector((state) => state.bot.isStart);
    const uiSelector = useAppSelector((state) => state.bot.uiSelector);
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

        const selectorbuttonCloseAll = uiSelector?.find((item) => item.code === "buttonCloseAll")?.selectorValue;
        if (!selectorbuttonCloseAll) {
            console.log(`Not found selector`, { selectorbuttonCloseAll });
            return;
        }

        handleCloseAll({
            webview,
            selector: {
                buttonCloseAll: selectorbuttonCloseAll,
            },
        });
    };
    return (
        <div className="px-5 sticky top-0 z-[1]">
            <Card>
                <CardHeader className="flex items-center gap-2">
                    <CardTitle className="text-base">Controll</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2 items-center">
                    <Button disabled={!isReady || isStart} onClick={start} size="sm">
                        Start
                    </Button>
                    <Button disabled={!isReady || !isStart} onClick={stop} size="sm">
                        Stop
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
