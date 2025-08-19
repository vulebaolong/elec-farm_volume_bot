import { useSaveAccount } from "@/api/tanstack/account.tanstack";
import Webview from "@/components/webview/webview";
import { handleCloseEntry, handleOpenEntry } from "@/helpers/entry-handler.helper";
import { tpPrice, tryJSONparse } from "@/helpers/function.helper";
import { closeOrderMap, ensureCloseForPosition, openOrderMap, syncOrderMaps } from "@/helpers/order-map";
import { analyzePositions } from "@/helpers/task-queue-order.helper";
import { useWebSocketHandler } from "@/hooks/use-socket-entry";
import { useSocketRoi } from "@/hooks/use-socket-roi";
import { TSaveAccountReq } from "@/types/account.type";
import { BotIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Priority24hChange from "../priority-24h-change/priority-24h-change";
import { PageTitle } from "../title-page/title-page";
import Controll from "./controll";
import { useAppSelector } from "@/redux/store";
import { toast } from "sonner";
import { THandleOpenPostOnlyEntry } from "@/types/entry.type";
import DescriptionOpenEntry from "../description-entry/description-open-entry";

export default function Bot() {
    const [isReady, setIsReady] = useState(false);
    const webviewRef = useRef<Electron.WebviewTag>(null);
    const saveAccount = useSaveAccount();
    const symbolsState = useAppSelector((state) => state.bot.symbolsState);
    const takeProfit = useAppSelector((state) => state.user.info?.SettingUsers.takeProfit);
    const uiSelector = useAppSelector((state) => state.bot.uiSelector);

    // lấy url cho webview preload
    const [wvPreload, setWvPreload] = useState<string>("");
    useEffect(() => {
        window.electron.webview.getPreloadUrl().then((url) => {
            // console.log('[webview] preload URL =', url);
            setWvPreload(url);
        });
    }, []);

    // lắng nghe thông tin account và lệnh đang mở để đồng bộ lên db
    useEffect(() => {
        const el = webviewRef.current;
        if (!el) return;

        const handler = async (e: any) => {
            const chanel = e.channel;
            const data = e.args?.[0];
            // xem e.channel để biết loại sự kiện
            if (chanel === "api-response") {
                // console.log('[webview ipc]', chanel, data);

                switch (data.url) {
                    case "/apiw/v2/futures/usdt/accounts":
                        try {
                            const dataFull = tryJSONparse(data.bodyPreview)?.data?.[0];
                            // console.log({ dataFull });
                            const payload: TSaveAccountReq = {
                                user: dataFull.user, //ID sàn
                                source: "gate",
                                margin_mode_name: dataFull.margin_mode_name, // Để biết đang dùng Isolated hay Classic
                                in_dual_mode: dataFull.in_dual_mode, // Đang dùng chế độ hỗn hợp
                                total: dataFull.total, // Tổng vốn
                                available: dataFull.available, // Số vốn có thể giao dịch
                                cross_available: dataFull.cross_available, // Vốn còn lại trong cross margin
                                isolated_position_margin: dataFull.isolated_position_margin, // Margin đang bị lock trong isolated
                                cross_initial_margin: dataFull.cross_initial_margin, // Margin đã bị dùng trong cross
                                cross_maintenance_margin: dataFull.cross_maintenance_margin, // Margin bảo trì
                                unrealised_pnl: dataFull.unrealised_pnl, // Lãi/lỗ chưa chốt (optional)
                                update_time: dataFull.update_time, // update_time
                            };
                            // console.log({ payload });

                            saveAccount.mutate(payload);
                        } catch (error) {
                            console.log({ error });
                        }
                        break;

                    case "/apiw/v2/futures/usdt/positions":
                        try {
                            if (!symbolsState || !takeProfit) return;
                            const selectorInputPosition = uiSelector?.find((item) => item.code === "inputPosition")?.selectorValue;
                            const selectorInputPrice = uiSelector?.find((item) => item.code === "inputPrice")?.selectorValue;
                            const selectorButtonLong = uiSelector?.find((item) => item.code === "buttonLong")?.selectorValue;
                            if (!selectorInputPosition || !selectorButtonLong || !selectorInputPrice) {
                                console.log(`Not found selector`, { selectorInputPosition, selectorButtonLong, selectorInputPrice });
                                return;
                            }
                            const dataFull = tryJSONparse(data.bodyPreview)?.data;
                            const openPositionsList = analyzePositions(dataFull);

                            if (!openPositionsList) return;

                            for (const pos of openPositionsList) {
                                // 🔥 Quan trọng: bảo đảm có lệnh CLOSE tương ứng (nếu thiếu)
                                const result = ensureCloseForPosition(pos, symbolsState, takeProfit); // có thể chỉnh 2-3 tuỳ biến động
                                if (!result) continue;

                                console.log(`Xây dựng close order:`, result);

                                const payload: THandleOpenPostOnlyEntry = {
                                    webview: el,
                                    payload: {
                                        side: result.side,
                                        symbol: result.contract,
                                        size: result.size,
                                        price: result.price,
                                        reduce_only: true,
                                    },
                                    selector: {
                                        inputPosition: selectorInputPosition,
                                        inputPrice: selectorInputPrice,
                                        buttonLong: selectorButtonLong,
                                    },
                                };
                                await handleOpenEntry(payload)
                                    .then(() => {
                                        const status = `Open Postion`;
                                        toast.success(`[SUCCESS] ${status}`, {
                                            description: <DescriptionOpenEntry symbol={result.contract} size={result.size} side={result.side} />,
                                        });
                                    })
                                    .catch((err) => {
                                        console.log({ err });
                                        const status = `Open Postion`;
                                        toast.error(`[ERROR] ${status}`, {
                                            description: <DescriptionOpenEntry symbol={result.contract} size={result.size} side={result.side} />,
                                        });
                                    });
                            }
                        } catch (error) {}
                        break;

                    case "/apiw/v2/futures/usdt/orders?contract=&status=open":
                        const dataFull = tryJSONparse(data.bodyPreview)?.data;
                        console.log({ dayne: dataFull });
                        syncOrderMaps(dataFull);
                        console.log("OPEN MAP", Array.from(openOrderMap.values()));
                        console.log("CLOSE MAP", Array.from(closeOrderMap.values()));
                        break;

                    default:
                        break;
                }
            }
        };

        el.addEventListener("ipc-message", handler);

        return () => {
            el.removeEventListener("ipc-message", handler);
        };
    }, [wvPreload, symbolsState, takeProfit, uiSelector]);

    // lắng nghe tín hiệu vào lệnh từ BE
    useWebSocketHandler({
        webviewRef: webviewRef,
        handleOpenEntry: handleOpenEntry,
    });

    useSocketRoi({ webviewRef, handleCloseEntry });

    return (
        <div className="">
            <PageTitle title="Bot" icon={BotIcon} size="md" />

            <div className="flex flex-col gap-5 h-full pb-10">
                <Controll isReady={isReady} webviewRef={webviewRef} />

                <Priority24hChange />

                <div className="px-5">
                    <div className="p-1 h-full border border-border shadow-lg rounded-2xl">
                        <div className="flex-1 overflow-auto rounded-2xl w-full h-full">
                            <div className="min-w-[1280px] h-full aspect-[6/5]">
                                {wvPreload && <Webview webviewRef={webviewRef} setIsReady={setIsReady} wvPreload={wvPreload} />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// -0.82%
// Entry Price: 115204.9
// Mark Price: 115277.9

// Initial Margin = (Entry Price × Contract Size × Quanto Multiplier) / Đòn bẩy
// (115204,9 * 1 * 0,0001) / 125 = 0,7680326667

// UnrealizedPnL = (MarkPrice - EntryPrice) * Size * quanto_multiplier
// (115277,9 - 115204,9) * 1 * 0,0001 = 0,0073

// Return % = (Unrealized PnL) / (Margin hiện tại) × 100%
// 0,0073 / 0,77 * 100 = 0,9504804049
