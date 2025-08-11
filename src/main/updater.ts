// main/updater.ts
import { app, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

let latestVersion: string | null = null;

export function setupUpdaterIPC() {
    // Cho phép prerelease nếu bạn phát hành beta
    // autoUpdater.allowPrerelease = true;

    autoUpdater.on("update-available", (info) => {
        latestVersion = info.version; // ví dụ "1.0.2"
    });
    autoUpdater.on("update-not-available", (info) => {
        latestVersion = info.version ?? null; // thường = current
    });
    autoUpdater.on("error", () => {
        /* log nếu cần */
    });

    // Renderer gọi để lấy version hiện tại + mới nhất
    ipcMain.handle("app:get-versions", async () => {
        const current = app.getVersion();
        // gọi check; có thể dùng checkForUpdatesAndNotify() nếu muốn notify luôn
        const res = await autoUpdater.checkForUpdates().catch(() => null);
        if (res?.updateInfo?.version) latestVersion = res.updateInfo.version;
        return { current, latest: latestVersion };
    });
}
