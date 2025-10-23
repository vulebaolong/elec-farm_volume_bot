// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

export type Channels =
    | "ipc-example"
    | "open-macro-window"
    | "macro-click"
    | "run-gate-macro"
    | "app:get-versions"
    | "bot:init"
    | "bot:isReady"
    | "bot:heartbeat"
    | "bot:start"
    | "bot:stop"
    | "bot:setWhiteList"
    | "bot:settingUser"
    | "bot:blackList"
    | "bot:whiteListMartingale"
    | "bot:whiteListIoc"
    | "bot:whiteListFarmIoc"
    | "bot:whiteListScalpIoc"
    | "bot:uiSelector"
    | "bot:log"
    | "bot:upsertFixStopLossQueue"
    | "bot:removeFixStopLossQueue"
    | "bot:createFixStopLossHistories"
    | "gate:get-state"
    | "gate:set-dock"
    | "gate:set-ratio"
    | "gate:move-overlay"
    | "gate:toggle"
    | "bot:sticky:set"
    | "bot:sticky:remove"
    | "bot:sticky:clear"
    | "bot:reloadWebContentsView"
    | "bot:rateCounter"
    | "bot:rateMax:set"
    | "bot:saveAccount"
    | "bot:takeProfitAccount"
    | "bot:upsertFixLiquidation"
    | "bot:upsertFixStopLoss"
    | "bot:isChildView"
    | "logs:path"
    | "logs:size"
    | "logs:read"
    | "logs:clear"
    | "logs:reveal"
    | "log:append"
    | "rate:counts:path"
    | "rate:counts:snapshot"
    | "rate:counts:clear"
    | "rate:counts:reveal"
    | "rate:counts:update"
    | "worker:init"
    | "worker:initMany"
    | "worker:stopAll"
    | "worker:toggleWebView"
    | "worker:stopOne"
    | "bot:ioc:long"
    | "bot:ioc:short"
    | "bot:ioc:hedge"
    | "bot:ioc:oneway"
    | "bot:ioc:fixStopLossIOC"
    | "bot:ioc:sideCount";

const electronHandler = {
    ipcRenderer: {
        /**
         * Gửi sự kiện "fire-and-forget" từ Renderer lên Main/Worker (không chờ kết quả).
         *
         * Dùng khi:
         * - Cập nhật trạng thái, báo hiệu, log… không cần phản hồi.
         * - Kích hoạt side effect ở Main (mở cửa sổ, đổi setting, gửi lệnh đến worker…).
         *
         * @param channel Kênh IPC đã whitelisted trong preload
         * @param args Payload (nên là object phẳng, tránh BigInt/Date thô)
         * @example
         * // Renderer: báo bot cập nhật setting
         * window.electron.ipcRenderer.sendMessage("bot:settingUser", {
         *   id: 3,
         *   leverage: 50,
         * });
         *
         * // Main:
         * ipcMain.on("bot:settingUser", (_evt, payload) => {
         *   workerPool.broadcast({ type: "SET_SETTING_USER", payload });
         * });
         */
        sendMessage(channel: Channels, ...args: any) {
            ipcRenderer.send(channel, ...args);
        },
        /**
         * Đăng ký lắng nghe push nhiều lần từ Main/Worker xuống Renderer.
         * Hàm trả về một function "off()" để hủy đăng ký – hãy gọi trong cleanup để tránh memory leak.
         *
         * Dùng khi:
         * - Nhận dữ liệu theo chu kỳ (tick 1s), tiến độ, log stream, rate counter…
         *
         * @param channel Kênh IPC (push) từ Main/Worker
         * @param handler Hàm xử lý dữ liệu
         * @returns Hàm off() để hủy listener
         * @example
         * // Renderer (React):
         * useEffect(() => {
         *   const off = window.electron.ipcRenderer.on("bot:rateCounter", (data) => {
         *     setCounter(data);
         *   });
         *   return () => off?.(); // nhớ hủy
         * }, []);
         *
         * // Main:
         * setInterval(() => {
         *   mainWindow?.webContents.send("bot:rateCounter", { "1s": 3, "1m": 17 });
         * }, 1000);
         */
        on(channel: Channels, func: (...args: any) => void) {
            const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
            ipcRenderer.on(channel, subscription);

            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        },
        /**
         * Lắng nghe một lần duy nhất. Tự động hủy sau khi nhận lần đầu.
         *
         * Dùng khi:
         * - Nhận gói dữ liệu khởi tạo, "ready", hay kết quả một phát là xong.
         *
         * @param channel Kênh IPC (push) từ Main/Worker
         * @param handler Hàm xử lý dữ liệu
         * @example
         * // Renderer:
         * window.electron.ipcRenderer.once("app:ready", (initData) => {
         *   bootstrap(initData);
         * });
         *
         * // Main:
         * app.whenReady().then(() => {
         *   mainWindow?.webContents.send("app:ready", { version: app.getVersion() });
         * });
         */
        once(channel: Channels, func: (...args: any) => void) {
            ipcRenderer.once(channel, (_event, ...args) => func(...args));
        },
        /**
         * Gọi RPC từ Renderer đến Main và **chờ Promise kết quả**.
         *
         * Dùng khi:
         * - Cần dữ liệu trả về hoặc cần biết lỗi (CRUD, đọc file, gọi API qua main…).
         *
         * @param channel Kênh IPC handle ở main qua `ipcMain.handle(channel, ...)`
         * @param args Payload gửi kèm
         * @returns Promise<unknown> Kết quả từ main (resolve/reject)
         * @example
         * // Renderer:
         * try {
         *   const user = await window.electron.ipcRenderer.invoke("auth:getInfo");
         *   dispatch(SET_INFO(user));
         * } catch (err) {
         *   console.error("getInfo failed:", err);
         * }
         *
         * // Main:
         * ipcMain.handle("auth:getInfo", async () => {
         *   const token = await tokenStore.get();
         *   if (!token) throw new Error("NO_TOKEN");
         *   return userService.getInfo(token);
         * });
         */
        invoke(channel: Channels, ...args: any) {
            return ipcRenderer.invoke(channel, ...args);
        },
    },
};

contextBridge.exposeInMainWorld("electron", electronHandler);

contextBridge.exposeInMainWorld("sessions", {
    list: () => ipcRenderer.invoke("sessions:list"),
    clear: (name: string) => ipcRenderer.invoke("sessions:clear", name),
    openPath: (name: string) => ipcRenderer.invoke("sessions:openPath", name),
});

export type ElectronHandler = typeof electronHandler;
