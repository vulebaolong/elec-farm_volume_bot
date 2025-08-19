import { closeOrder, openOrder, openOrderPostOnly, TOpenOrder, TOpenOrderPostOnly } from "@/javascript-string/logic-farm";
import { TRespnoseGate } from "@/types/base.type";
import { THandleCloseEntry, THandleOpenEntry, THandleOpenPostOnlyEntry } from "@/types/entry.type";
import { TOrderRes } from "@/types/order.type";
import { tryJSONparse } from "./function.helper";
import { cancelAndRemoveTask_QueueOrder } from "./task-queue-order.helper";

export const handleOpenEntry = async ({ webview, payload, selector }: THandleOpenPostOnlyEntry) => {
    try {
        const waitForOrder = new Promise((resolve: (value: TRespnoseGate<any>) => void) => {
            const handler = (event: any) => {
                const chanel = event.channel;
                const data = event.args?.[0];
                if (chanel === "api-response" && data.url === "/apiw/v2/futures/usdt/orders") {
                    const dataFull: TRespnoseGate<any> = tryJSONparse(data.bodyPreview);
                    webview.removeEventListener("ipc-message", handler);
                    resolve(dataFull);
                }
            };
            webview.addEventListener("ipc-message", handler);
        });

        // const payloadForOpenOrder: TOpenOrder = {
        //     symbol: payload.symbol,
        //     size: payload.side === "long" ? payload.size : `-${payload.size}`,
        //     selector: selector,
        // };

        // const stringOrder = openOrder(payloadForOpenOrder);

        const payloadForOpenOrder: TOpenOrderPostOnly = {
            symbol: payload.symbol,
            size: payload.size,
            price: payload.price,
            reduce_only: payload.reduce_only,
            selector: {
                buttonLong: selector.buttonLong,
                inputPrice: selector.inputPrice,
                inputPosition: selector.inputPosition,
            },
        };

        console.log("payloadForOpenOrder: ", payloadForOpenOrder);

        const stringOrder = openOrderPostOnly(payloadForOpenOrder);
        // console.log('Open Order string: ', stringOrder);
        await webview.executeJavaScript(stringOrder);
        const result: TOrderRes = await waitForOrder;
        if (result.code >= 400) throw new Error(`${payload.symbol}: ${result.message}`);

        console.log(`✅ 🟢Open Order ${payloadForOpenOrder.symbol} - ${payload.side} - ${payload.size} - `, result);
    } catch (err: any) {
        console.error("❌ 🟢Open Order failed: ", err.message);
        throw err;
    }
};

export const handleCloseEntry = async ({ webview, payload, flag, selector }: THandleCloseEntry) => {
    try {
        const waitForOrder = new Promise((resolve: (value: TRespnoseGate<any>) => void) => {
            const handler = (event: any) => {
                const chanel = event.channel;
                const data = event.args?.[0];
                if (chanel === "api-response" && data.url === "/apiw/v2/futures/usdt/orders") {
                    const dataFull: TRespnoseGate<any> = tryJSONparse(data.bodyPreview);
                    webview.removeEventListener("ipc-message", handler);
                    resolve(dataFull);
                }
            };
            webview.addEventListener("ipc-message", handler);
        });

        const stringOrder = closeOrder({
            symbol: payload.symbol,
            side: payload.side,
            selector,
        });

        // console.log('Close Order string: ', stringOrder);
        await webview.executeJavaScript(stringOrder);
        const result = await waitForOrder;
        if (result.code !== 200) throw new Error(`${payload.symbol}: ${result.message}`);

        console.log(`✅ 🔴Close Order ${flag} - ${payload.symbol} - ${payload.side} - ${payload.size} - `, result);
        cancelAndRemoveTask_QueueOrder(payload.symbol);
    } catch (err: any) {
        console.error(`❌ 🔴Close Order ${flag} failed: `, err.message);
        throw err;
    }
};
