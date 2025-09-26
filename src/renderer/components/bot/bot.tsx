import { BotIcon } from "lucide-react";
import { PageTitle } from "../title-page/title-page";
import Controll from "./controll";
import Ripple from "./ripple";
import Log from "../log/log";
import PassiveSticky from "../log/terminal-log/passive-sticky";
import RateCounter from "../rate-counter/rate-counter";
import Martingale from "../martingale/martingale";

export default function Bot() {
    // const saveAccount = useSaveAccount();

    // // lấy url cho webview preload
    // const [wvPreload, setWvPreload] = useState<string>("");
    // useEffect(() => {
    //     window.electron.webview.getPreloadUrl().then((url) => {
    //         // console.log('[webview] preload URL =', url);
    //         setWvPreload(url);
    //     });
    // }, []);

    // // lắng nghe thông tin account và lệnh đang mở để đồng bộ lên db
    // useEffect(() => {

    //     const handler = async (e: any) => {
    //         const chanel = e.channel;
    //         const data = e.args?.[0];
    //         // xem e.channel để biết loại sự kiện
    //         if (chanel === "api-response") {
    //             // console.log('[webview ipc]', chanel, data);

    //             switch (data.url) {
    //                 case "/apiw/v2/futures/usdt/accounts":
    //                     try {
    //                         const dataFull = tryJSONparse(data.bodyPreview)?.data?.[0];
    //                         // console.log({ dataFull });
    //                         const payload: TSaveAccountReq = {
    //                             user: dataFull.user, //ID sàn
    //                             source: "gate",
    //                             margin_mode_name: dataFull.margin_mode_name, // Để biết đang dùng Isolated hay Classic
    //                             in_dual_mode: dataFull.in_dual_mode, // Đang dùng chế độ hỗn hợp
    //                             total: dataFull.total, // Tổng vốn
    //                             available: dataFull.available, // Số vốn có thể giao dịch
    //                             cross_available: dataFull.cross_available, // Vốn còn lại trong cross margin
    //                             isolated_position_margin: dataFull.isolated_position_margin, // Margin đang bị lock trong isolated
    //                             cross_initial_margin: dataFull.cross_initial_margin, // Margin đã bị dùng trong cross
    //                             cross_maintenance_margin: dataFull.cross_maintenance_margin, // Margin bảo trì
    //                             unrealised_pnl: dataFull.unrealised_pnl, // Lãi/lỗ chưa chốt (optional)
    //                             update_time: dataFull.update_time, // update_time
    //                         };
    //                         // console.log({ payload });

    //                         saveAccount.mutate(payload);
    //                     } catch (error) {
    //                         console.log({ error });
    //                     }
    //                     break;

    //                 // case "/apiw/v2/futures/usdt/positions":
    //                 //     try {
    //                 //         const dataFull: TPosition[] = tryJSONparse(data.bodyPreview)?.data;
    //                 //         const openPositionsList = dataFull.filter((pos) => Number(pos.size) !== 0);

    //                 //         if (!openPositionsList) return;

    //                 //         botRef.current?.clearPositions();
    //                 //         for (const pos of openPositionsList) {
    //                 //             botRef.current?.setPosition(pos);
    //                 //         }
    //                 //     } catch (error) {}
    //                 //     break;

    //                 // case "/apiw/v2/futures/usdt/orders?contract=&status=open":
    //                 //     const dataFull: TGetOrderOpenRes["data"] = tryJSONparse(data.bodyPreview)?.data;
    //                 //     console.log({ dayne: dataFull });
    //                 //     botRef.current?.setOrderOpens(dataFull);
    //                 //     break;

    //                 default:
    //                     break;
    //             }
    //         }
    //     };

    //     el.addEventListener("ipc-message", handler);

    //     return () => {
    //         el.removeEventListener("ipc-message", handler);
    //     };
    // }, [wvPreload]);

    return (
        <div className="">
            <PageTitle
                title={
                    <span className="flex items-center gap-3 text-2xl font-bold">
                        Bot <Ripple />
                    </span>
                }
                icon={BotIcon}
                size="md"
            />

            <div className="flex flex-col gap-5 h-full p-5">
                {/* <GateDockPanel /> */}
                <Controll />
                <RateCounter />
                <Martingale />
                <Log />
                <PassiveSticky />
                {/* <RateCountsPanel /> */}
            </div>
        </div>
    );
}

/**
{
    "contract": "AI16Z_USDT",
    "side": "long",
    "size": "-1",
    "price": "0.1187"
}
 */

/**
{
    "contract": "AI16Z_USDT",
    "side": "long",
    "size": "-1",
    "price": "0.1187"
}
 */
