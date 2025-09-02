// main/gate-dock.ts
import { BrowserWindow, WebContentsView, ipcMain } from "electron";

type DockMode = "right" | "bottom" | "overlay" | "hidden";
type DockState = {
    mode: DockMode;
    ratio: number; // 0.2..0.85 cho right/bottom
    overlay: { w: number; h: number; corner: "tl" | "tr" | "bl" | "br"; margin: number };
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function installGateDock(mainWindow: BrowserWindow, gateView: WebContentsView) {
    // trạng thái mặc định
    const st: DockState = {
        mode: "right",
        ratio: 0.42,
        overlay: { w: 480, h: 360, corner: "br", margin: 16 },
    };

    const layout = () => {
        if (!mainWindow) return;
        const { width, height } = mainWindow.getContentBounds();

        switch (st.mode) {
            case "right": {
                const w = Math.round(width * clamp(st.ratio, 0.2, 0.85));
                gateView.setBounds({ x: width - w, y: 0, width: w, height });
                break;
            }
            case "bottom": {
                const h = Math.round(height * clamp(st.ratio, 0.2, 0.85));
                gateView.setBounds({ x: 0, y: height - h, width, height: h });
                break;
            }
            case "overlay": {
                const { w, h, margin, corner } = st.overlay;
                const x = corner.endsWith("r") ? width - w - margin : margin;
                const y = corner.startsWith("b") ? height - h - margin : margin;
                gateView.setBounds({ x, y, width: w, height: h });
                break;
            }
            case "hidden": {
                // co về 0 thay vì removeChildView để bật/tắt mượt
                gateView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
                break;
            }
        }
    };

    // lần đầu & các sự kiện cần reflow
    layout();
    mainWindow.on("resize", layout);
    mainWindow.on("enter-full-screen", layout);
    mainWindow.on("leave-full-screen", layout);

    // IPC điều khiển từ renderer
    ipcMain.handle("gate:set-dock", (_e, p: Partial<DockState>) => {
        if (p.mode) st.mode = p.mode;
        if (typeof p.ratio === "number") st.ratio = clamp(p.ratio, 0.2, 0.85);
        if (p.overlay) st.overlay = { ...st.overlay, ...p.overlay };
        layout();
    });

    ipcMain.handle("gate:toggle", () => {
        st.mode = st.mode === "hidden" ? "right" : "hidden";
        layout();
    });

    ipcMain.handle("gate:set-ratio", (_e, ratio: number) => {
        st.ratio = clamp(ratio, 0.2, 0.85);
        layout();
    });

    ipcMain.handle("gate:move-overlay", (_e, corner: DockState["overlay"]["corner"]) => {
        st.mode = "overlay";
        st.overlay.corner = corner;
        layout();
    });

    ipcMain.handle("gate:get-state", () => ({ ...st }));

    return { layout, getState: () => ({ ...st }) };
}
