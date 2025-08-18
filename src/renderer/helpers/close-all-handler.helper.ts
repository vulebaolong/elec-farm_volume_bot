import { clickCloseAll, TClickCloseAll } from "@/javascript-string/logic-farm";
import { TOrderRes } from "@/types/order.type";
import { toast } from "sonner";
import { tryJSONparse } from "./function.helper";

export type THandleCloseAll = {
    webview: Electron.WebviewTag;
    selector: TClickCloseAll["selector"];
};

export const handleCloseAll = async ({ webview, selector }: THandleCloseAll) => {
    try {
        const waitForOrder = new Promise<TOrderRes>((resolve) => {
            const handler = (event: any) => {
                const chanel = event.channel;
                const data = event.args?.[0];
                if (chanel === "api-response" && data.url === "/apiw/v2/futures/usdt/positions/close_all") {
                    const dataFull = tryJSONparse(data.bodyPreview);
                    webview.removeEventListener("ipc-message", handler);
                    resolve(dataFull);
                }
            };
            webview.addEventListener("ipc-message", handler);
        });

        const stringCloseAll = clickCloseAll({ selector });
        // console.log('Open Order string: ', stringCloseAll);
        await webview.executeJavaScript(stringCloseAll);
        const result: TOrderRes = await waitForOrder;
        console.log(`✅ Close All Result`, result);
        toast.success(`Close All success`);
    } catch (err: any) {
        console.error("❌ Close All failed: ", err.message);
        // toast.success(`Close All failed`);
        // throw err;
    }
};
