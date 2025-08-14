import { useSaveAccount } from "@/api/tanstack/account.tanstack";
import Webview from "@/components/webview/webview";
import { handleCloseEntry, handleOpenEntry } from "@/helpers/entry-handler.helper";
import { analyzePositions, tryJSONparse } from "@/helpers/function.helper";
import { useWebSocketHandler } from "@/hooks/use-socket-entry";
import { useSocketRoi } from "@/hooks/use-socket-roi";
import { TSaveAccountReq } from "@/types/account.type";
import { useEffect, useRef, useState } from "react";
import ButtonStartStop from "./button-start-stop/button-start-stop";
import { PageTitle } from "../title-page/title-page";
import { BotIcon } from "lucide-react";

export default function Bot() {
    const [isReady, setIsReady] = useState(false);
    const webviewRef = useRef<Electron.WebviewTag>(null);
    const saveAccount = useSaveAccount();

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

        const handler = (e: any) => {
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
                            const dataFull = tryJSONparse(data.bodyPreview)?.data;
                            analyzePositions(dataFull);
                        } catch (error) {}
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
    }, [wvPreload]);

    // lắng nghe tín hiệu vào lệnh từ BE
    useWebSocketHandler({
        webviewRef: webviewRef,
        handleOpenEntry: handleOpenEntry,
    });

    useSocketRoi({ webviewRef, handleCloseEntry });

    return (
        <div className="">
            <PageTitle title="Bot" icon={BotIcon} size="md" />

            <div className="flex flex-col gap-4 h-full p-2 pb-10 ">
                <div className="flex items-center gap-2">
                    <ButtonStartStop isReady={isReady} webviewRef={webviewRef} />
                </div>

                <div className="p-1 h-full border border-border shadow-lg rounded-2xl aspect-[6/5]">
                    <div className="flex-1 overflow-auto rounded-2xl w-full h-full">
                        <div className="min-w-[1000px] h-full">
                            {wvPreload && <Webview webviewRef={webviewRef} setIsReady={setIsReady} wvPreload={wvPreload} />}
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
