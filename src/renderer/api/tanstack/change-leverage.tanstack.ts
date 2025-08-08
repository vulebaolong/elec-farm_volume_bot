import { changeLeverage } from "@/javascript-string/logic-farm";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGetWhiteList } from "./white-list.tanstack";
import { IS_PRODUCTION } from "@/constant/app.constant";
import { TSetting } from "@/types/setting.type";

export type TUseChangeLeverage = {
    webview: Electron.WebviewTag;
    leverage: TSetting["leverage"];
};

export const useChangeLeverage = () => {
    const getWhiteList = useGetWhiteList();

    return useMutation({
        mutationFn: async ({ webview, leverage }: TUseChangeLeverage) => {
            if (!getWhiteList.data) {
                toast.warning(`White List not found`);
                return;
            }
            console.log({ whiteList: getWhiteList.data });
            const entries = Object.entries(getWhiteList.data);
            for (const [key, value] of entries) {
                const stringOrder = changeLeverage({
                    symbol: key,
                    leverage: IS_PRODUCTION ? leverage.toString() : value.leverage_max.toString(),
                });
                await webview.executeJavaScript(stringOrder);
            }

            toast.success("Change Laverage Successfully");

            return true;
        },
        onError: (error) => {
            console.log({ useChangeLeverage: error });
        },
    });
};
