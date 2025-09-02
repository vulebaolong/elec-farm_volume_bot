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
    | "bot:uiSelector"
    | "bot:metrics";

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

    webview: {
        getPreloadUrl(): Promise<string> {
            return ipcRenderer.invoke("get-webview-preload-url");
        },
    },
};

contextBridge.exposeInMainWorld("electron", electronHandler);

export type ElectronHandler = typeof electronHandler;
