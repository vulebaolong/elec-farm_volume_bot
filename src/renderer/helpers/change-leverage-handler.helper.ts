import { IS_PRODUCTION } from "@/constant/app.constant";
import { changedLaveragelist } from "./white-list.helper";
import { toast } from "sonner";
import { TRespnoseGate } from "@/types/base.type";
import { createCodeStringchangeLeverage } from "@/javascript-string/logic-farm";

type TChangeLeverageHandler = {
    symbol: string;
    leverageNumber: number;
    webview: Electron.WebviewTag;
};

export const changeLeverageHandler = async ({ symbol, leverageNumber, webview }: TChangeLeverageHandler): Promise<boolean> => {
    // console.log(`changedLaveragelist: ${symbol}`, changedLaveragelist, changedLaveragelist.has(symbol));
    if (!changedLaveragelist.has(symbol)) {
        try {
            const leverageString = leverageNumber.toString();
            const stringOrder = createCodeStringchangeLeverage({
                symbol: symbol,
                leverage: leverageString,
            });
            const result: TRespnoseGate<any> = await webview.executeJavaScript(stringOrder);
            // console.log({ reusltne: result });

            // Check response code
            if (result.code >= 400) {
                throw new Error(`Change leverage failed: ${result.message}`);
            }

            // Check cả 2 chiều (dual mode)
            if (result.data?.[0]?.leverage !== leverageString || result.data?.[1]?.leverage !== leverageString) {
                throw new Error(
                    `resLeverage !== settingUsers.leverage: 
                                        long=${result.data?.[0]?.leverage} 
                                        short=${result.data?.[1]?.leverage} 
                                        expected=${leverageString}`,
                );
            }

            changedLaveragelist.add(symbol);
            if (!IS_PRODUCTION) {
                toast.success(`Change Leverage Successfully: ${symbol} - ${leverageString}`);
            }
            return true;
        } catch (error) {
            console.log("Change leverage error", error);
            toast.error(`Change Leverage Failed: ${symbol}`);
            return false; // ⛔ Dừng hẳn, không vào lệnh
        }
    } else {
        // console.log(`Đã tồn tại ${symbol} trong changedLaveragelist => bỏ qua`, changedLaveragelist);
        return true;
    }
};
