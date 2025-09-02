// main/force-desktop.ts
import type { WebContentsView } from "electron";

export function forceDesktopLayout(gateView: WebContentsView, opts?: { width?: number; height?: number }) {
    const wc = gateView.webContents;
    const W = opts?.width ?? 1000;
    const H = opts?.height ?? 900;

    // 1) Attach CDP headless
    try {
        if (!wc.debugger.isAttached()) {
            wc.debugger.attach("1.3");
        }
    } catch (e) {
        console.error("[debugger.attach failed]", e);
    }

    // 2) UA desktop (phòng khi site phục vụ bản mobile theo UA)
    wc.debugger.sendCommand("Emulation.setUserAgentOverride", {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    });

    // 3) Giả lập viewport desktop (layout theo 1440×900)
    wc.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
        width: W,
        height: H,
        deviceScaleFactor: 1,
        mobile: false,
        scale: 1,
        screenWidth: W,
        screenHeight: H,
    });

    // 4) Bật cuộn ngang nếu page có overflow-x: hidden
//     wc.insertCSS(`
//     html, body { overflow-x: auto !important; }
//     /* tránh phần tử wrapper nào đó chặn ngang */
//     [style*="overflow-x:hidden"], .no-horizontal-scroll { overflow-x: auto !important; }
//   `);

    // Gỡ khi destroy
    wc.once("destroyed", () => {
        try {
            wc.debugger.detach();
        } catch {}
    });
}
