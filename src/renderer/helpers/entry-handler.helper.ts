import { closeOrder, openOrder, TOpenOrder } from "@/javascript-string/logic-farm";
import { THandleEntry } from "@/types/entry.type";
import { TOrderRes } from "@/types/order.type";
import { tryJSONparse } from "./function.helper";
import { cancelAndRemoveTask_QueueOrder } from "./task-queue-order.helper";

export const handleOpenEntry = async ({ webview, payload }: THandleEntry) => {
    try {
        const waitForOrder = new Promise<TOrderRes>((resolve) => {
            const handler = (event: any) => {
                const chanel = event.channel;
                const data = event.args?.[0];
                if (chanel === "api-response" && data.url === "/apiw/v2/futures/usdt/orders") {
                    const dataFull = tryJSONparse(data.bodyPreview);
                    webview.removeEventListener("ipc-message", handler);
                    resolve(dataFull);
                }
            };
            webview.addEventListener("ipc-message", handler);
        });

        const payloadForOpenOrder: TOpenOrder = {
            symbol: payload.symbol,
            size: payload.side === "long" ? "1" : "-1",
        };

        const stringOrder = openOrder(payloadForOpenOrder);
        // console.log('Open Order string: ', stringOrder);
        await webview.executeJavaScript(stringOrder);
        const result: TOrderRes = await waitForOrder;
        console.log(`✅ 🟢Open Order ${payloadForOpenOrder.symbol} ${payload.side} Result`, result);
    } catch (err: any) {
        console.error("❌ 🟢Open Order failed: ", err.message);
        throw err;
    }
};

export const handleCloseEntry = async ({ webview, payload, flag }: THandleEntry) => {
    try {
        const waitForOrder = new Promise((resolve) => {
            const handler = (event: any) => {
                const chanel = event.channel;
                const data = event.args?.[0];
                if (chanel === "api-response" && data.url === "/apiw/v2/futures/usdt/orders") {
                    const dataFull = tryJSONparse(data.bodyPreview);
                    webview.removeEventListener("ipc-message", handler);
                    resolve(dataFull);
                }
            };
            webview.addEventListener("ipc-message", handler);
        });

        const stringOrder = closeOrder({
            symbol: payload.symbol,
            side: payload.side,
        });

        // console.log('Close Order string: ', stringOrder);
        await webview.executeJavaScript(stringOrder);
        const result = await waitForOrder;
        console.log(`✅ 🔴Close Order ${flag} ${payload.symbol} ${payload.side} Result`, result);
    } catch (err: any) {
        console.error(`❌ 🔴Close Order ${flag} failed: `, err.message);
        throw err;
    } finally {
        cancelAndRemoveTask_QueueOrder(payload.symbol);
    }
};
