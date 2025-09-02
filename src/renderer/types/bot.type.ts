export type TDataInitBot = {
    parentPort: import("worker_threads").MessagePort;
    settingUser: any;
    uiSelector: any;
};

export type TChangeLeverageHandler = {
    symbol: string;
    leverageNumber: number;
    webview: Electron.WebviewTag;
};
