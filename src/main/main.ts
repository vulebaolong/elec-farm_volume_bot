import { IS_PRODUCTION } from "@/constant/app.constant";
import { app, BrowserWindow, ipcMain, powerMonitor, shell } from "electron";
import { installExtension, REDUX_DEVTOOLS } from "electron-devtools-installer";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import { pathToFileURL } from "node:url";
import path from "path";
import { initGateView } from "./gate/gate-view";
import MenuBuilder from "./menu";
import { registerMetricsIPC } from "./metrics";
import { setupUpdaterIPC } from "./updater";
import { resolveHtmlPath } from "./util";
import { initBot } from "./workers/init.worker";

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

if (!isDebug) {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
    console.trace = () => {};
}

class AppUpdater {
    constructor() {
        log.transports.file.level = "info";
        autoUpdater.logger = log;
        autoUpdater.checkForUpdatesAndNotify();
    }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on("ipc-example", async (event, arg) => {
    const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
    console.log(msgTemplate(arg));
    event.reply("ipc-example", msgTemplate("pong"));
});

if (process.env.NODE_ENV === "production") {
    const sourceMapSupport = require("source-map-support");
    sourceMapSupport.install();
}

if (isDebug) {
    require("electron-debug").default();
}

const installExtensions = async () => {
    const installer = require("electron-devtools-installer");
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    const extensions = ["REACT_DEVELOPER_TOOLS"];

    return installer
        .default(
            extensions.map((name) => installer[name]),
            forceDownload,
        )
        .catch(console.log);
};

const createWindow = async () => {
    if (isDebug) {
        await installExtensions();
    }

    const RESOURCES_PATH = app.isPackaged ? path.join(process.resourcesPath, "assets") : path.join(__dirname, "../../assets");

    const getAssetPath = (...paths: string[]): string => {
        return path.join(RESOURCES_PATH, ...paths);
    };

    const MIN_WIDTH = 1024; // >= lg của Tailwind (desktop)
    const MIN_HEIGHT = 700;

    mainWindow = new BrowserWindow({
        show: false,
        // width: 1024,
        // height: 728,
        // fullscreen: true,
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
        useContentSize: true,
        icon: getAssetPath("icon.png"),
        webPreferences: {
            webviewTag: true,
            preload: app.isPackaged ? path.join(__dirname, "preload.js") : path.join(__dirname, "../../.erb/dll/preload.js"),
        },
    });

    setupUpdaterIPC();
    // registerMetricsIPC();
    const gateView = initGateView(mainWindow, isDebug);
    initBot(mainWindow, gateView);

    mainWindow.loadURL(resolveHtmlPath("index.html"));

    mainWindow.on("ready-to-show", () => {
        if (!mainWindow) {
            throw new Error('"mainWindow" is not defined');
        }
        if (process.env.START_MINIMIZED) {
            mainWindow.minimize();
        } else {
            mainWindow.maximize();
            mainWindow.show();
        }
        // Khi máy chuẩn bị sleep
        powerMonitor.on("suspend", () => {
            console.log("Máy sắp sleep");
        });

        // Khi máy wake lại từ sleep
        powerMonitor.on("resume", () => {
            console.log("Máy vừa wake lại từ sleep");
        });

        // Nếu cần detect cả lock/unlock screen
        powerMonitor.on("lock-screen", () => {
            console.log("Màn hình đã bị khóa");
        });

        powerMonitor.on("unlock-screen", () => {
            console.log("Màn hình đã được mở khóa");
        });
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    const menuBuilder = new MenuBuilder(mainWindow);
    menuBuilder.buildMenu();

    // Open urls in the user's browser
    mainWindow.webContents.setWindowOpenHandler((edata) => {
        shell.openExternal(edata.url);
        return { action: "deny" };
    });

    // Remove this if your app does not use auto updates
    // eslint-disable-next-line
    new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on("window-all-closed", async () => {
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.whenReady()
    .then(() => {
        if (!IS_PRODUCTION) {
            installExtension(REDUX_DEVTOOLS)
                .then((ext) => console.log(`Added Extension:  ${ext.name}`))
                .catch((err) => console.log("An error occurred: ", err));
        }

        createWindow();
        app.on("activate", () => {
            // On macOS it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (mainWindow === null) createWindow();
        });
    })
    .catch(console.log);

ipcMain.handle("get-webview-preload-url", () => {
    // Dev: đọc thẳng trong thư mục dự án
    const devPath = path.join(process.cwd(), "assets", "webview", "wv-preload.js");

    // Prod: dùng file đã copy vào resources
    const prodPath = path.join(process.resourcesPath, "assets", "webview", "wv-preload.js");

    const finalPath = app.isPackaged ? prodPath : devPath;
    return pathToFileURL(finalPath).toString(); // -> "file:///.../wv-preload.js"
});
