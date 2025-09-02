import { shell, BrowserWindow, WebContentsView } from "electron";

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
    const H_PANEL = 300;
    const layoutGateView = () => {
        if (!mainWindow) return;
        const { width, height } = mainWindow.getContentBounds();
        gateView.setBounds({
            x: L_PANEL,
            y: H_PANEL,
            width: Math.max(0, width - L_PANEL),
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
    gateView.webContents.loadURL("https://www.gate.com/futures/USDT/BTC_USDT");

    // Debug DevTools riêng cho Gate (tùy chọn)
    if (isDebug) {
        gateView.webContents.openDevTools({ mode: "detach" });
    }

    // Ví dụ: bạn có thể intercept request của Gate tại đây nếu cần
    // const sess = gateView.webContents.session;
    // sess.webRequest.onBeforeSendHeaders((details, callback) => {
    //   console.log("Gate request:", details.url);
    //   callback({ cancel: false, requestHeaders: details.requestHeaders });
    // });

    return gateView;
}

