import { setLocalStorageScript } from "@/javascript-string/logic-farm";
import { BrowserWindow, WebContentsView, app, shell } from "electron";
import path from "path";
import fs from "node:fs";

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
            preload: path.join(app.isPackaged ? __dirname : path.join(__dirname, "../../assets"), "gate-preload.js"),
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
    layoutGateView();
    mainWindow.on("resize", layoutGateView);

    gateView.webContents.setWindowOpenHandler(({ url }) => {
        // mở popup ngoài app
        shell.openExternal(url);
        return { action: "deny" };
    });

    blockGateWebSockets(gateView);

    // load trang Gate
    gateView.webContents.loadURL("https://www.gate.com/futures/USDT/BTC_USDT").then(() => {
        gateView.webContents.executeJavaScript(setLocalStorageScript, true);
    });

    if (isDevtoolsEnabledByFile()) {
        gateView.webContents.openDevTools({ mode: "detach" });
    }

    return gateView;
}

export function blockGateWebSockets(gateView: WebContentsView) {
    const sess = gateView.webContents.session;
    const filter = { urls: ["wss://*/*", "ws://*/*"] };

    sess.webRequest.onBeforeRequest(filter, (details, cb) => {
        // Chỉ chặn WS từ domain của Gate (để không ảnh hưởng chỗ khác dùng chung session)
        const host = new URL(details.url).host;
        const isGate = /gate\.com$|gateio\./i.test(host);
        if (details.resourceType === "webSocket" && isGate) {
            // huỷ handshake => trang không thiết lập được WS
            return cb({ cancel: true });
        }
        cb({ cancel: false });
    });
}

export const DEVTOOLS_FLAG_FILENAME = ".enable-devtools";

export function desktopFlagPath(): string {
    return path.join(app.getPath("desktop"), DEVTOOLS_FLAG_FILENAME);
}

export function userDataFlagPath(): string {
    return path.join(app.getPath("userData"), DEVTOOLS_FLAG_FILENAME);
}

export function isDevtoolsEnabledByFile(): boolean {
    try {
        return fs.existsSync(desktopFlagPath());
    } catch {
        return false;
    }
}
