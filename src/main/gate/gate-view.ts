import { setLocalStorageScript } from "@/javascript-string/logic-farm";
import { shell, BrowserWindow, WebContentsView } from "electron";
import { forceDesktopLayout } from "../force-desktop";
import { installGateDock } from "./gate-dock";

export function initGateView(mainWindow: BrowserWindow, isDebug: boolean) {
    // --- Gate WebContentsView ---
    const gateView = new WebContentsView({
        webPreferences: {
            // bảo mật: không cần Node integration trong trang web Gate
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,

            // dùng session riêng để bạn intercept cookie / webRequest, v.v.
            partition: "persist:gate",

            // nếu bạn có preload riêng cho Gate (không bắt buộc)
            // preload: path.join(app.isPackaged ? __dirname : path.join(__dirname, "../../assets"), "gate-preload.js"),
        },
    });

    // add vào contentView root của window
    mainWindow.contentView.addChildView(gateView);

    // layout: để Gate chiếm bên phải, phần trái để app React hiển thị
    const L_PANEL = 600; // px: độ rộng panel trái cho UI của bạn
    const x = 900;
    const H_PANEL = 470;
    const layoutGateView = () => {
        if (!mainWindow) return;
        const { width, height } = mainWindow.getContentBounds();
        gateView.setBounds({
            x: width - x,
            y: H_PANEL,
            width: x,
            height: Math.max(0, height - H_PANEL),
        });
    };

    // gọi lần đầu & gắn listener resize
    layoutGateView();
    mainWindow.on("resize", layoutGateView);

    gateView.webContents.setWindowOpenHandler(({ url }) => {
        // mở popup ngoài app
        shell.openExternal(url);
        return { action: "deny" };
    });

    // load trang Gate
    gateView.webContents.loadURL("https://www.gate.com/futures/USDT/BTC_USDT").then(() => {
        gateView.webContents.executeJavaScript(setLocalStorageScript, true);
    });

    // Debug DevTools riêng cho Gate (tùy chọn)
    if (isDebug) {
        gateView.webContents.openDevTools({ mode: "detach" });
    }

    gateView.webContents.once("did-finish-load", () => {
        // forceDesktopLayout(gateView);
        // installGateDock(mainWindow, gateView);
    });

    return gateView;
}
