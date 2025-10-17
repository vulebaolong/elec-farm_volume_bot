import fs from "fs";
import { IS_PRODUCTION } from "@/constant/app.constant";
import { app, BrowserWindow, ipcMain, powerMonitor, session, shell } from "electron";
import { installExtension, REDUX_DEVTOOLS } from "electron-devtools-installer";
import { autoUpdater } from "electron-updater";
import path from "path";
import { initLog } from "./log";
import MenuBuilder from "./menu";
import { setupUpdaterIPC } from "./updater";
import { resolveHtmlPath } from "./util";
import { BotWorkerManager } from "./workers/worker-manager";

const log = initLog();

const mainLog = log.scope("main");
const workerLog = log.scope("worker");

mainLog.info("1) ✅ Main started =================");

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";
// const isDebug = false;

if (!isDebug) {
    // console.log = () => {};
    // console.debug = () => {};
    // console.info = () => {};
    // console.trace = () => {};
    // redirect để tất cả console.* ghi vào file log
    Object.assign(console, log.functions);
}

class AppUpdater {
    constructor() {
        // log.transports.file.level = "info";
        // autoUpdater.logger = log;
        autoUpdater.checkForUpdatesAndNotify();
    }
}

// let mainWindow: BrowserWindow | null = null;

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

    const mainWindow = new BrowserWindow({
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
            partition: 'persist:app',
            preload: app.isPackaged ? path.join(__dirname, "preload.js") : path.join(__dirname, "../../.erb/dll/preload.js"),
        },
    });

    setupUpdaterIPC();

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
        // mainWindow = null;
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

    return mainWindow;
};

/**
 * Add event listeners...
 */

app.on("window-all-closed", async () => {
    app.quit();
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    // if (process.platform !== "darwin") {
    //     app.quit();
    // }
});

app.whenReady()
    .then(async () => {
        if (!IS_PRODUCTION) {
            installExtension(REDUX_DEVTOOLS)
                .then((ext) => console.log(`Added Extension:  ${ext.name}`))
                .catch((err) => console.log("An error occurred: ", err));
        }
        const mainWindow = await createWindow();

        new BotWorkerManager(mainWindow, mainLog, workerLog);

        // app.on("activate", () => {
        //     // On macOS it's common to re-create a window in the app when the
        //     // dock icon is clicked and there are no other windows open.
        //     // createWindow();
        // });
    })
    .catch(console.log);

ipcMain.on("ipc-example", async (event, arg) => {
    const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
    console.log(msgTemplate(arg));
    event.reply("ipc-example", msgTemplate("pong"));
});

type SessionInfo = {
    name: string; // "default" | "persist:xxx"
    path: string; // absolute folder path on disk
    existsOnDisk: boolean;
};

// Lấy list session persistent (thư mục trong userData/Partitions) + default
function getAllSessionsInfo(): SessionInfo[] {
    const userData = app.getPath("userData");
    const partitionsDir = path.join(userData, "Partitions");

    const list: SessionInfo[] = [
        {
            name: "default",
            path: userData, // default session lưu ngay trong userData
            existsOnDisk: true,
        },
    ];

    if (fs.existsSync(partitionsDir)) {
        const folders = fs.readdirSync(partitionsDir, { withFileTypes: true });
        for (const d of folders) {
            if (!d.isDirectory()) continue;
            // Thư mục partition persistent chính là tên partition, thường giữ nguyên "persist:..."
            const partitionName = d.name; // ví dụ: "persist:gate:123"
            const absPath = path.join(partitionsDir, partitionName);
            list.push({
                name: partitionName,
                path: absPath,
                existsOnDisk: true,
            });
        }
    }

    return list;
}

// Clear storage cho một session theo tên
async function clearOneSessionByName(name: string) {
    const ses = name === "default" ? session.defaultSession : session.fromPartition(name);
    // Xóa dữ liệu web storage (cookies/localStorage/IndexedDB/service workers/…)
    await ses.clearStorageData();
    // Xóa cache http
    await ses.clearCache();
}

// Open folder của session
async function openSessionFolder(name: string) {
    const userData = app.getPath("userData");
    const dir = name === "default" ? userData : path.join(userData, "Partitions", name);
    // Mở thẳng thư mục trong file manager
    await shell.openPath(dir);
}

// IPC handlers
ipcMain.handle("sessions:list", async () => {
    return getAllSessionsInfo();
});

ipcMain.handle("sessions:clear", async (_e, name: string) => {
    await clearOneSessionByName(name);
    return { ok: true };
});

ipcMain.handle("sessions:openPath", async (_e, name: string) => {
    await openSessionFolder(name);
    return { ok: true };
});
