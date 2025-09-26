// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

export type Channels =
    | "ipc-example"
    | "open-macro-window"
    | "macro-click"
    | "run-gate-macro"
    | "get-webview-preload-url"
    | "app:get-versions"
    | "metrics"
    | "bot:init"
    | "bot:isReady"
    | "bot:heartbeat"
    | "bot:start"
    | "bot:stop"
    | "bot:setWhiteList"
    | "bot:settingUser"
    | "bot:blackList"
    | "bot:uiSelector"
    | "bot:log"
    | "bot:metrics"
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
    | "bot:martingale"
    | "bot:rateMax:set"
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
    | "devtools:toggle";

const electronHandler = {
    ipcRenderer: {
        // bắn đi (không chờ kết quả).
        sendMessage(channel: Channels, ...args: any) {
            ipcRenderer.send(channel, ...args);
        },
        // nhận push nhiều lần
        on(channel: Channels, func: (...args: any) => void) {
            const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
            ipcRenderer.on(channel, subscription);

            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        },
        // once = một lần
        once(channel: Channels, func: (...args: any) => void) {
            ipcRenderer.once(channel, (_event, ...args) => func(...args));
        },
        // gọi hàm & nhận Promise (cần kết quả).
        invoke(channel: Channels, ...args: any) {
            return ipcRenderer.invoke(channel, ...args);
        },
    },
};

contextBridge.exposeInMainWorld("electron", electronHandler);

export type ElectronHandler = typeof electronHandler;
