// bot.worker.ts
import { LogLevel } from "@/components/terminal-log/terminal-log";
import { createCodeStringClickCancelAllOpen, createCodeStringClickTabOpenOrder, TOpenOrderPostOnly } from "@/javascript-string/logic-farm";
import { TGateApiRes } from "@/types/base-gate.type";
import {
    StickySetPayload,
    TChangeLeverage,
    TClickCancelAllOpenRes,
    TClickTabOpenOrderRes,
    TDataInitBot,
    TDataOrder,
    TFectWorkRes,
    TGateClickCancelAllOpenRes,
    TGateClickTabOpenOrderRes,
    TGateFectMainRes,
    TGateOrderMainRes,
    TOrderWorkRes,
    TPayloadClickCancelAllOpen,
    TPayloadClickTabOpenOrder,
    TPayloadOrder,
    TUiSelectorOrder,
} from "@/types/bot.type";
import { TOrderOpen } from "@/types/order.type";
import { TPosition } from "@/types/position.type";
import { TSettingUsers } from "@/types/setting-user.type";
import { TUiSelector } from "@/types/ui-selector.type";
import { TWorkerData } from "@/types/worker.type";
import { performance } from "node:perf_hooks";
import { parentPort } from "node:worker_threads";
import { checkSize, handleSize, isDepthCalc, isSpreadPercent } from "./util-bot.worker";
import { TWhiteList, TWhitelistEntry } from "@/types/white-list.type";
import { TSide } from "@/types/base.type";
import { TGetInfoContractRes } from "@/types/contract.type";
import axios from "axios";
import { TRes } from "@/types/app.type";
import { BASE_URL } from "@/constant/app.constant";
import { ENDPOINT } from "@/constant/endpoint.constant";
import { TBidsAsks } from "@/types/bids-asks.type";

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

if (!isDebug) {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
    console.trace = () => {};
}

let bot: Bot | null = null;

parentPort!.on("message", (msg: any) => {
    // console.log({ type: msg?.type }); // giữ nếu cần debug
    switch (msg?.type) {
        case "bot:init":
            if (!bot) {
                const dataInitBot = {
                    parentPort: parentPort!,
                    settingUser: msg.payload.settingUser,
                    uiSelector: msg.payload.uiSelector,
                };
                bot = new Bot(dataInitBot);
            }
            break;
        default:
            bot?.handleEvent?.(msg); // chuyển tiếp cho bot
    }
});

class Bot {
    private count = 0;
    private running = false;
    private parentPort: import("worker_threads").MessagePort;
    private isStart = false;
    private orderOpens: TOrderOpen[] = [];
    private positions = new Map<string, TPosition>();
    private changedLaveragelist: Set<string> = new Set();
    private settingUser: TSettingUsers;
    private uiSelector: TUiSelector[];
    private whitelistEntry: TWhitelistEntry[] = [];
    private whiteList: TWhiteList = {};
    private infoContract = new Map<string, TGetInfoContractRes>();

    constructor(dataInitBot: TDataInitBot) {
        this.parentPort = dataInitBot.parentPort;
        this.settingUser = dataInitBot.settingUser;
        this.uiSelector = dataInitBot.uiSelector;

        this.run();
        this.isReady();
    }

    private async run() {
        if (this.running) return;
        this.running = true;

        for (;;) {
            const iterStart = performance.now();
            try {
                this.log("\n\n\n\n\n");
                this.log(`✅✅✅✅✅ ITER START ${this.count} | ${this.isStart} | ${this.running} =====`);
                this.beforeEach();

                if (this.isStart) {
                    let isRefreshed_1_CREATE_CLOSE = false;
                    let isRefreshed_2_CLEAR_OPEN = false;
                    let isRefreshed_3_CREATE_OPEN = false;
                    let isRefreshed_4_SL_ROI = false;

                    isRefreshed_1_CREATE_CLOSE = await this.createTPClose(isRefreshed_1_CREATE_CLOSE);

                    // ===== 2) CLEAR OPEN =====
                    this.log("🟢🟢🟢🟢🟢 Clear Open");
                    if (this.orderOpens.length > 0) {
                        if (isRefreshed_1_CREATE_CLOSE === false) await this.refreshSnapshot("Clear Open");

                        const contractsToCancel = this.contractsToCancelWithEarliest();
                        // console.log(`contractsToCancel`, contractsToCancel);

                        let isShouldRefresh = false;
                        // lấy ra tất cả các lệnh open, với is_reduce_only = false
                        for (const contract of contractsToCancel) {
                            if (this.isTimedOutClearOpen(contract.earliest, contract.contract)) {
                                await this.clickCanelAllOpen(contract.contract);
                                isShouldRefresh = true;
                            }
                            isRefreshed_1_CREATE_CLOSE = await this.createTPClose(isRefreshed_1_CREATE_CLOSE);
                        }

                        if (isShouldRefresh) {
                            await this.refreshSnapshot("Clear Open");
                            isRefreshed_2_CLEAR_OPEN = true;
                        }

                        this.log("✅ Clear Open: done");
                    } else {
                        this.log("Clear Open: no order open");
                    }
                    this.log("🟢🟢🟢🟢🟢 Clear Open");
                    console.log("\n\n");

                    // ===== 3) CREATE OPEN =====
                    this.log("🔵🔵🔵🔵🔵 Create Open");
                    if (isRefreshed_2_CLEAR_OPEN === false) await this.refreshSnapshot("Create Open");
                    if (this.isCheckwhitelistEntryEmty() && this.isCheckMaxOpenPO()) {
                        for (const whitelistItem of Object.values(this.whitelistEntry)) {
                            const { symbol, sizeStr, side, bidBest, askBest, order_price_round } = whitelistItem;

                            // nếu đã max thì không vào thoát vòng lặp
                            if (!this.isCheckMaxOpenPO()) {
                                this.log(`Create Open: break by maxTotalOpenPO: ${this.settingUser.maxTotalOpenPO}`);
                                break;
                            }

                            // nếu symbol đó đã tồn tại trong orderOpens -> bỏ qua
                            if (this.isOrderExitsByContract(symbol)) {
                                this.log(`Create Open: skip ${symbol} (already exists)`);
                                continue;
                            }

                            this.log(`Create Open: ${symbol} ok (not exists) | side=${side} | sizeStr=${sizeStr}`);

                            const ok = await this.changeLeverage(symbol, this.settingUser.leverage);
                            if (!ok) continue;

                            const bidsAsks = await this.getBidsAsks(symbol);

                            const prices = bidsAsks[side === "long" ? "bids" : "asks"].slice(1, 5 + 1);
                            // const prices = bidsAsks[side === "long" ? "bids" : "asks"].slice(1, 2);
                            this.log(`Create Open: ${prices.length} ladder order(s)`, prices);

                            for (const price of prices) {
                                const payloadOpenOrder: TPayloadOrder = {
                                    contract: symbol,
                                    size: side === "long" ? sizeStr : `-${sizeStr}`,
                                    price: price.p,
                                    reduce_only: false, // false là lệnh open
                                };
                                try {
                                    await this.openEntry(payloadOpenOrder, `Open`);
                                } catch (error: any) {
                                    this.sendLogUi(`${error.message}`, "error");
                                    continue;
                                }
                                isRefreshed_1_CREATE_CLOSE = await this.createTPClose(isRefreshed_1_CREATE_CLOSE);
                            }

                            await this.refreshSnapshot("Create Open");
                            isRefreshed_3_CREATE_OPEN = true;

                            this.log("✅ Create Open: done for symbol", symbol);
                        }
                    } else {
                        this.log(`Create Open: skipped by isCheckwhitelistEntryEmty and isCheckMaxOpenPO`);
                    }
                    this.log("🔵🔵🔵🔵🔵 Create Open");
                    console.log("\n\n");

                    // ===== 4) SL / ROI =====
                    this.log("🟣🟣🟣🟣🟣 SL/Timeout");
                    if (this.positions.size > 0) {
                        for (const [, pos] of this.positions) {
                            await this.handleRoi(pos);
                            // isRefreshed_1_CREATE_CLOSE = await this.createTPClose(isRefreshed_1_CREATE_CLOSE);
                        }

                        await this.refreshSnapshot("Roi");
                        isRefreshed_4_SL_ROI = true;

                        this.log("✅ Roi: done");
                    } else {
                        this.log("SL/Timeout: no positions");
                    }
                    this.log("🟣🟣🟣🟣🟣 SL/Timeout");
                    console.log("\n\n");

                    if (!isRefreshed_1_CREATE_CLOSE && !isRefreshed_2_CLEAR_OPEN && !isRefreshed_3_CREATE_OPEN && !isRefreshed_4_SL_ROI) {
                        await this.refreshSnapshot("All");
                    }
                } else {
                    this.log("isStart=false → skip all work");
                }
            } catch (err: any) {
                this.log("❌❌❌❌❌ ITER ERROR =====", err);
                this.sendLogUi(err.message, "error");
            } finally {
                const dt = Math.round(performance.now() - iterStart);
                this.count += 1;
                this.log(`✅✅✅✅✅ ITER END (took ${dt}ms) =====`, "");
                await this.sleep(1000);
            }
        }
    }

    private isReady() {
        const data: TWorkerData<{ isReady: boolean }> = {
            type: "bot:isReady",
            payload: { isReady: true },
        };
        this.parentPort?.postMessage(data);
    }

    private async createTPClose(isRefreshed_1_CREATE_CLOSE: boolean) {
        // ===== 1) CREATE TP CLOSE =====
        this.log("🩵🩵🩵🩵🩵 Create TP Close");
        // this.sendLogUi("💋 Check TP")
        if (this.positions.size > 0) {
            const payloads = await this.getCloseOrderPayloads(); // 1 bước: tính + build payload

            for (const p of payloads) {
                // console.log("Create close order:", p);
                try {
                    await this.openEntry(p, `TP: Close`);
                } catch (error: any) {
                    this.sendLogUi(`${error.message}`, "error");
                    continue;
                }
            }

            await this.refreshSnapshot("Close");
            isRefreshed_1_CREATE_CLOSE = true;

            this.log("✅ Create Close: done");
        } else {
            this.log("Create Close: no positions");
        }
        this.log("🩵🩵🩵🩵🩵 Create TP Close");
        console.log("\n\n");
        return isRefreshed_1_CREATE_CLOSE;
    }

    private beforeEach() {
        this.parentPort?.postMessage({
            type: "bot:heartbeat",
            payload: {
                ts: Date.now(),
                isStart: this.isStart,
            },
        });

        // this.parentPort?.postMessage({ type: "bot:metrics", payload: snapshotWorkerMetrics() });

        this.setWhitelistEntry();

        // this.sendLogUi(`count: ${this.count}`);
    }

    handleEvent(msg: any) {
        switch (msg.type) {
            case "bot:start":
                this.isStart = true;
                this.parentPort?.postMessage({ type: "bot:start", payload: { isStart: this.isStart } });
                break;

            case "bot:stop":
                this.isStart = false;
                this.parentPort?.postMessage({ type: "bot:stop", payload: { isStart: this.isStart } });
                break;

            case "bot:setWhiteList":
                this.setWhitelist(msg.payload);
                break;

            case "bot:settingUser":
                this.setSettingUser(msg.payload);
                break;

            case "bot:uiSelector":
                this.setUiSelector(msg.payload);
                break;

            default:
                break;
        }
    }

    private sleep(ms: number) {
        return new Promise((r) => setTimeout(r, ms));
    }

    private async getOrderOpens() {
        const url = "https://www.gate.com/apiw/v2/futures/usdt/orders?contract=&status=open";

        const { body, error, ok } = await this.gateFetch<TGateApiRes<TOrderOpen[] | null>>(url);
        if (ok === false || error || body === null) {
            const msg = `❌ Get Order Opens: ${error}`;
            throw new Error(msg);
        }

        if (body?.code >= 400 || body?.code < 0) {
            const msg = `❌ Get Order Opens: ${body?.message || "Unknown"}`;
            throw new Error(msg);
        }

        if (body?.data === null || body?.data === undefined) return [];

        return body.data;
    }

    private async getPositions() {
        const url = "https://www.gate.com/apiw/v2/futures/usdt/positions";

        const { body, error, ok } = await this.gateFetch<TGateApiRes<TPosition[] | null>>(url);
        if (ok === false || error || body === null) {
            const msg = `❌ Get Positions: ${error}`;
            throw new Error(msg);
        }

        if (body?.code >= 400 || body?.code < 0) {
            const msg = `❌ Get Position: ${body?.message || "Unknown"}`;
            throw new Error(msg);
        }

        if (body?.data === null || body?.data === undefined) return [];

        const openPositionsList = body.data.filter((pos) => Number(pos.size) !== 0);
        return openPositionsList;
    }

    private setOrderOpens(orderOpens: TOrderOpen[]) {
        this.orderOpens = orderOpens || [];
    }
    private replacePositions(list: TPosition[]) {
        this.positions.clear();
        for (const p of list) this.setPosition(p);
    }
    private setPosition(value: TPosition) {
        const marginMode = Number(value.leverage) === 0 ? "cross" : "isolated";
        const contract = value.contract.replace("/", "_");
        const side = value.size > 0 ? "long" : "short";
        const key = `${contract}-${marginMode}-${side}-${value.leverage}`;
        this.positions.set(contract, value);
    }

    /** Làm mới orderOpens kèm timeout & log */
    private async refreshOrderOpens(ctx = "Refresh"): Promise<void> {
        const orderOpens = await this.getOrderOpens();
        this.setOrderOpens(orderOpens || []);
        this.log(`${ctx}: refresh orderOpens`);
    }

    /** Làm mới positions kèm timeout & log */
    private async refreshPositions(ctx = "Refresh"): Promise<void> {
        const pos = await this.getPositions();
        this.replacePositions(pos);
        this.log(`${ctx}: refresh positions`);
    }

    /** Combo: làm mới cả orderOpens & positions (tuần tự để tránh đè webview) */
    private async refreshSnapshot(ctx = "Refresh"): Promise<void> {
        await this.refreshOrderOpens(ctx);
        await this.refreshPositions(ctx);
        this.log(`✅ ${ctx}: snapshot updated`);
    }

    private seq = 0;

    private gateFetch<T>(url: string, init?: any, timeoutMs = 10_000): Promise<TFectWorkRes<T>> {
        const reqId = ++this.seq;
        const port = this.parentPort!;

        return new Promise<TFectWorkRes<T>>((resolve) => {
            let settled = false;
            let timer: NodeJS.Timeout;

            const done = (r: TFectWorkRes<T>) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                try {
                    port.off("message", onMsg);
                } catch {}
                resolve(r);
            };

            const onMsg = (m: any) => {
                try {
                    if (m?.type !== "bot:fetch:res") return;
                    if (m.payload?.reqId !== reqId) return;

                    const p: TGateFectMainRes = m.payload;
                    if (!p.ok) return done({ ok: false, body: null, error: p.error || "fetch failed" });

                    let parsed: T;
                    try {
                        parsed = JSON.parse(p.bodyText) as T;
                    } catch (e) {
                        return done({ ok: false, body: null, error: `Invalid JSON from ${url}: ${String(e)}` });
                    }

                    return done({ ok: true, body: parsed, error: null });
                } catch (e) {
                    return done({ ok: false, body: null, error: `gateFetch handler error: ${String(e)}` });
                }
            };

            // 1) nghe trước
            port.on("message", onMsg);

            // 2) timeout RPC (phòng main không hồi)
            timer = setTimeout(() => {
                done({ ok: false, body: null, error: "gateFetch rpc timeout" });
            }, timeoutMs);

            // 3) gửi sau
            port.postMessage({ type: "bot:fetch", payload: { url, init, reqId, timeoutMs } });
        });
    }

    private sendLogUi(text: string, level: LogLevel | undefined = "info") {
        this.parentPort?.postMessage({
            type: "bot:log",
            payload: { ts: Date.now(), level, text: text },
        });
    }

    private log(step: string, data?: any) {
        const ts = new Date().toISOString();
        if (data !== undefined) console.log(`[Bot][${ts}] ${step}`, data);
        else console.log(`[Bot][${ts}] ${step}`);
    }

    private async changeLeverage(symbol: string, leverageNumber: number): Promise<boolean> {
        if (this.changedLaveragelist.has(symbol)) {
            this.log(`✅ Change Leverage [EXISTS] ${symbol} skip => `, this.changedLaveragelist);
            return true;
        }

        const leverageString = leverageNumber.toString();

        const url = `https://www.gate.com/apiw/v2/futures/usdt/positions/${symbol}/leverage`;

        const { body, error, ok } = await this.gateFetch<TGateApiRes<TChangeLeverage[] | null>>(url, {
            method: "POST",
            body: JSON.stringify({ leverage: leverageString }),
            headers: { "Content-Type": "application/json" },
        });
        if (ok === false || error || body === null) {
            const msg = `❌ Change Leverage: ${error}`;
            throw new Error(msg);
        }

        const { code, data, message } = body;

        if (code >= 400 || code < 0) {
            const msg = `❌ Change Leverage: ${symbol} | code:${code} | ${message}`;
            this.log(msg);
            this.sendLogUi(msg, `error`);
            return false;
        }

        if (data === null || data === undefined) {
            const msg = `❌ Change Leverage: data is ${data}`;
            throw new Error(msg);
        }

        if (data?.[0]?.leverage !== leverageString || data?.[1]?.leverage !== leverageString) {
            const msg = `❌ Change Leverage: ${symbol} | mismatched leverage`;
            this.log(msg);
            this.sendLogUi(msg, `error`);
            return false;
        }

        this.changedLaveragelist.add(symbol);
        const msg = `✅ Change Leverage: ${symbol} | ${leverageString}`;
        this.log(msg);
        this.sendLogUi(msg, `info`);

        return true;
    }

    private async openEntry(payload: TPayloadOrder, label: string) {
        const selectorInputPosition = this.uiSelector?.find((item) => item.code === "inputPosition")?.selectorValue;
        const selectorInputPrice = this.uiSelector?.find((item) => item.code === "inputPrice")?.selectorValue;
        const selectorButtonLong = this.uiSelector?.find((item) => item.code === "buttonLong")?.selectorValue;
        if (!selectorInputPosition || !selectorButtonLong || !selectorInputPrice) {
            console.log(`Not found selector`, { selectorInputPosition, selectorButtonLong, selectorInputPrice });
            throw new Error(`Not found selector`);
        }

        const dataSelector: TUiSelectorOrder = {
            inputPosition: selectorInputPosition,
            inputPrice: selectorInputPrice,
            buttonLong: selectorButtonLong,
        };

        const { body, error, ok } = await this.createOrder<TGateApiRes<TOrderOpen | null>>(payload, dataSelector);

        if (ok === false || error || body === null) {
            const msg = `❌ ${payload.contract} - ${label} ${Number(payload.size) >= 0 ? "long" : "short"} | ${payload.size} | ${payload.price}: ${error}`;
            throw new Error(msg);
        }

        if (body?.code >= 400 || body?.code < 0) {
            const msg = `❌ ${payload.contract} - ${label} ${Number(payload.size) >= 0 ? "long" : "short"} | ${payload.size} | ${payload.price}: ${body?.message || "Unknown"}`;
            throw new Error(msg);
        }

        if (body?.data === null || body?.data === undefined) {
            const msg = `❌ ${payload.contract} - ${label} ${Number(payload.size) >= 0 ? "long" : "short"} | ${payload.size} | ${payload.price}: data is ${body?.data}`;
            throw new Error(msg);
        }

        const status = `✅ ${payload.contract} - ${label} ${Number(payload.size) >= 0 ? "long" : "short"} | ${payload.size} | ${payload.price}`;
        this.sendLogUi(status);

        return body.data;
    }

    private seqOrder = 0;

    private async createOrder<T>(payload: TPayloadOrder, dataSelector: TUiSelectorOrder, timeoutMs = 10_000): Promise<TOrderWorkRes<T>> {
        const reqOrderId = ++this.seqOrder;
        const port = this.parentPort!;

        return new Promise<TOrderWorkRes<T>>((resolve) => {
            let settled = false;
            let timer: NodeJS.Timeout;

            const done = (r: TFectWorkRes<T>) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                try {
                    port.off("message", onMsg);
                } catch {}
                resolve(r);
            };

            const onMsg = (m: any) => {
                try {
                    if (m?.type !== "bot:order:res") return;
                    if (m.payload?.reqOrderId !== reqOrderId) return;

                    const p: TGateOrderMainRes = m.payload;
                    if (!p.ok) return done({ ok: false, body: null, error: p.error || "Order failed" });

                    let parsed: T;
                    try {
                        parsed = JSON.parse(p.bodyText) as T;
                    } catch (e) {
                        return done({ ok: false, body: null, error: `Invalid JSON from Order: ${String(e)}` });
                    }

                    return done({ ok: true, body: parsed, error: null });
                } catch (e) {
                    return done({ ok: false, body: null, error: `Order handler error: ${String(e)}` });
                }
            };

            // 1) nghe trước
            port.on("message", onMsg);

            // 2) timeout RPC (phòng main không hồi)
            timer = setTimeout(() => {
                done({ ok: false, body: null, error: "Order rpc timeout" });
            }, timeoutMs);

            const data: TWorkerData<TDataOrder> = {
                type: "bot:order",
                payload: {
                    reqOrderId,
                    payloadOrder: payload,
                    selector: dataSelector,
                },
            };

            // 3) gửi sau
            port.postMessage(data);
        });
    }

    private async clickTabOpenOrder() {
        const selectorButtonTabOpenOrder = this.uiSelector?.find((item) => item.code === "buttonTabOpenOrder")?.selectorValue;
        if (!selectorButtonTabOpenOrder) {
            console.log(`Not found selector`, { selectorButtonTabOpenOrder });
            throw new Error(`Not found selector`);
        }
        const stringClickTabOpenOrder = createCodeStringClickTabOpenOrder({ buttonTabOpenOrder: selectorButtonTabOpenOrder });

        const { body, error, ok } = await this.sendClickTabOpenOrder<boolean | null>(stringClickTabOpenOrder);

        if (ok === false || error || body === null) {
            const msg = `❌ Click Tab Open Order error: ${error}`;
            throw new Error(msg);
        }
        if (body === false) {
            const msg = `❌ Click Tab Open Order body: ${body}`;
            throw new Error(msg);
        }

        return body;
    }

    private seqClickTabOpenOrder = 0;

    private async sendClickTabOpenOrder<T>(stringClickTabOpenOrder: string, timeoutMs = 10_000): Promise<TClickTabOpenOrderRes<T>> {
        const reqClickTabOpenOrderId = ++this.seqClickTabOpenOrder;
        const port = this.parentPort!;

        return new Promise<TClickTabOpenOrderRes<T>>((resolve) => {
            let settled = false;
            let timer: NodeJS.Timeout;

            const done = (r: TClickTabOpenOrderRes<T>) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                try {
                    port.off("message", onMsg);
                } catch {}
                resolve(r);
            };

            const onMsg = (m: any) => {
                try {
                    if (m?.type !== "bot:clickTabOpenOrder:res") return;
                    if (m.payload?.reqClickTabOpenOrderId !== reqClickTabOpenOrderId) return;
                    console.log(`ClickTabOpenOrder res`, m.payload);
                    const p: TGateClickTabOpenOrderRes = m.payload;
                    if (!p.ok) return done({ ok: false, body: null, error: p.error || "ClickTabOpenOrder failed" });

                    return done({ ok: true, body: p.body as T, error: null });
                } catch (e) {
                    return done({ ok: false, body: null, error: `ClickTabOpenOrder handler error: ${String(e)}` });
                }
            };

            // 1) nghe trước
            port.on("message", onMsg);

            // 2) timeout RPC (phòng main không hồi)
            timer = setTimeout(() => {
                done({ ok: false, body: null, error: "sendClickTabOpenOrder rpc timeout" });
            }, timeoutMs);

            const payload: TPayloadClickTabOpenOrder = {
                reqClickTabOpenOrderId,
                stringClickTabOpenOrder,
            };

            // 3) gửi sau
            port.postMessage({ type: "bot:clickTabOpenOrder", payload: payload });
        });
    }

    private async clickCanelAllOpen(contract: string) {
        await this.clickTabOpenOrder();

        const selectorTableOrderPanel = this.uiSelector?.find((item) => item.code === "tableOrderPanel")?.selectorValue;
        if (!selectorTableOrderPanel) {
            console.log(`Not found selector`, { selectorTableOrderPanel });
            throw new Error(`Not found selector`);
        }
        const stringClickCanelAllOpen = createCodeStringClickCancelAllOpen({
            contract: contract.replace("/", "").replace("_", ""),
            tableOrderPanel: selectorTableOrderPanel,
        });

        const { body, error, ok } = await this.sendClickCanelAllOpen<TGateClickCancelAllOpenRes["body"]>(stringClickCanelAllOpen);

        if (ok === false || error || body === null) {
            const msg = `❌ Click Cancel All Order error: ${error} ${body} ${ok}`;
            throw new Error(msg);
        }

        this.sendLogUi(`✅ ${contract} Cancel All Open: ${body.clicked}`);
        this.removeSticky(`timeout:${contract}`);

        return body;
    }

    private seqClickCanelAllOpenOrder = 0;

    private async sendClickCanelAllOpen<T>(stringClickCanelAllOpen: string, timeoutMs = 10_000): Promise<TClickCancelAllOpenRes<T>> {
        const reqClickCanelAllOpenOrderId = ++this.seqClickCanelAllOpenOrder;
        const port = this.parentPort!;

        return new Promise<TClickCancelAllOpenRes<T>>((resolve) => {
            let settled = false;
            let timer: NodeJS.Timeout;

            const done = (r: TClickCancelAllOpenRes<T>) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                try {
                    port.off("message", onMsg);
                } catch {}
                resolve(r);
            };

            const onMsg = (m: any) => {
                try {
                    if (m?.type !== "bot:clickCanelAllOpen:res") return;
                    if (m.payload?.reqClickCanelAllOpenOrderId !== reqClickCanelAllOpenOrderId) return;
                    const p: TGateClickCancelAllOpenRes = m.payload;
                    console.log(`clickCanelAllOpen res`, m.payload);
                    if (!p.ok) return done({ ok: false, body: null, error: p.error || "clickCanelAllOpen failed" });

                    return done({ ok: true, body: p.body as T, error: null });
                } catch (e) {
                    return done({ ok: false, body: null, error: `clickCanelAllOpen handler error: ${String(e)}` });
                }
            };

            // 1) nghe trước
            port.on("message", onMsg);

            // 2) timeout RPC (phòng main không hồi)
            timer = setTimeout(() => {
                done({ ok: false, body: null, error: "sendClickTabOpenOrder rpc timeout" });
            }, timeoutMs);

            const payload: TPayloadClickCancelAllOpen = {
                reqClickCanelAllOpenOrderId,
                stringClickCanelAllOpen,
            };

            // 3) gửi sau
            port.postMessage({ type: "bot:clickCanelAllOpen", payload: payload });
        });
    }

    private removeSticky(key: string) {
        this.parentPort?.postMessage({ type: "bot:sticky:remove", payload: { key } });
    }

    private setWhitelistEntry() {
        const whiteListArr = Object.values(this.whiteList);
        if (whiteListArr.length === 0) {
            this.whitelistEntry = [];
            return;
        }

        this.whitelistEntry = []; // cho bot

        for (const whitelistItem of whiteListArr) {
            const { core, contractInfo } = whitelistItem;
            const { askBest, askSumDepth, bidBest, bidSumDepth, imbalanceAskPercent, imbalanceBidPercent, lastPrice, spreadPercent, symbol } =
                core ?? {};

            const { order_price_round } = contractInfo;

            const missing =
                !symbol ||
                spreadPercent == null ||
                bidSumDepth == null ||
                askSumDepth == null ||
                lastPrice == null ||
                imbalanceAskPercent == null ||
                imbalanceBidPercent == null ||
                order_price_round == null;

            if (missing) {
                const msg = `❌ ${symbol ?? "UNKNOWN"} core thiếu field: ${JSON.stringify(core)}`;
                this.log(msg);
                this.sendLogUi(msg, "error");
                continue;
            }

            const isSpread = isSpreadPercent(spreadPercent, this.settingUser.minSpreadPercent, this.settingUser.maxSpreadPercent);
            const isDepth = isDepthCalc(askSumDepth, bidSumDepth, this.settingUser.maxDepth);

            const sizeStr = handleSize(whitelistItem, this.settingUser.inputUSDT);
            const isSize = checkSize(sizeStr);

            const isLong = imbalanceBidPercent > this.settingUser.ifImbalanceBidPercent;
            const isShort = imbalanceAskPercent > this.settingUser.ifImbalanceAskPercent;
            const side = isLong ? "long" : isShort ? "short" : null;

            const qualified = isSpread && isDepth && isSize && !!side;
            // console.log({
            //     symbol,
            //     qualified,
            //     side,
            //     isSpread,
            //     isDepth,
            //     isSize,
            // });

            // Thu thập cho bot nếu đủ điều kiện
            if (qualified && side) {
                this.whitelistEntry.push({
                    symbol,
                    sizeStr,
                    side,
                    askBest,
                    bidBest,
                    order_price_round,
                });
            }
        }
    }

    private async getCloseOrderPayloads(): Promise<TPayloadOrder[]> {
        const payloads: TPayloadOrder[] = [];

        for (const [, pos] of this.positions) {
            const remain = this.getRemainingToClose(pos);
            if (remain <= 0) continue; // đã đủ cover

            const side = this.getCloseSideForPos(pos);
            const sizeSigned = side === "long" ? +remain : -remain;

            const contractSlash = pos.contract; // "PI/USDT"
            const contract = contractSlash.replace("/", "_"); // "PI_USDT"

            const infoContract = await this.getInfoContract(contract);
            if (!infoContract) {
                console.log(`❌ getCloseOrderPayloads: infoContract not found: ${contract}`);
                this.sendLogUi(`❌ getCloseOrderPayloads: infoContract not found: ${contract}`, "error");
                continue;
            }
            const tickSize = infoContract.order_price_round;

            // tính TP theo phía của POSITION (long -> +%, short -> -%)
            const entry_price = Number(pos.entry_price);
            const takeProfit = this.settingUser.takeProfit;
            const sideFortpPrice = this.getPosSide(pos);

            const lastPrice = await this.getLastPrice(contract);
            if (!lastPrice) {
                console.log(`❌ getLastPrice: lastPrice not found: ${contract}`);
                this.sendLogUi(`❌ getLastPrice: lastPrice not found: ${contract}`, "error");
                continue;
            }
            this.log(`✅ getLastPrice: lastPrice: ${lastPrice}`);

            const price = this.tpPrice(entry_price, takeProfit, sideFortpPrice, tickSize, lastPrice);

            payloads.push({
                contract: contract,
                size: String(sizeSigned),
                price,
                reduce_only: true, // true là lệnh close
            });
        }

        return payloads;
    }

    /** số lượng còn thiếu để đóng hết position */
    private getRemainingToClose(pos: TPosition): number {
        const need = Math.abs(pos.size);
        const covered = this.getCloseCoverage(pos);
        const remain = need - covered;
        return remain > 0 ? remain : 0;
    }

    /** tổng khối lượng lệnh close (reduce-only) còn treo cho position */
    private getCloseCoverage(pos: TPosition): number {
        return this.orderOpens
            .filter((o) => this.isCloseOrderForPosition(pos, o))
            .reduce((sum, o) => {
                const remain = Math.abs((o as any).left ?? o.size); // ưu tiên 'left' nếu có
                return sum + remain;
            }, 0);
    }

    /** Có phải là lệnh close tương ứng với position không? (đã đúng contract + đúng phía) */
    private isCloseOrderForPosition(pos: TPosition, ord: TOrderOpen): boolean {
        if (ord.contract !== pos.contract) {
            // console.log(`2 contract khác nhau => bỏ qua`, ord.contract, pos.contract);
            return false;
        }

        if (!ord.is_reduce_only) {
            // console.log(`${pos.contract} so sánh với ${ord.contract} Không phải lệnh đóng => bỏ qua | is_reduce_only: ${ord.is_reduce_only}`);
            return false;
        }

        const posSide = this.getPosSide(pos);
        const { label, intent } = this.classify(ord);

        // console.log({
        //     contract: ord.contract,
        //     posSide: posSide,
        //     label,
        //     intent,
        // });

        if (intent !== "close") return false;

        // label sẽ là 'close_long' | 'close_short'
        return posSide === label.split("_")[1]; // true nếu 'close_long' với long, 'close_short' với short
    }

    private getPosSide(pos: TPosition): TSide {
        if (pos.mode === "dual_long") return "long";
        if (pos.mode === "dual_short") return "short";
        return pos.size >= 0 ? "long" : "short"; // single mode fallback
    }

    private classify(orderOpen: TOrderOpen) {
        const side = this.getOrderSide(orderOpen);
        const intent = orderOpen.is_reduce_only ? "close" : "open";
        let label;
        if (intent === "open") {
            label = orderOpen.size > 0 ? "open_long" : "open_short";
        } else {
            label = orderOpen.size > 0 ? "close_short" : "close_long";
        }
        return { side, intent, label };
    }

    private getOrderSide(o: TOrderOpen): TSide {
        return o.size >= 0 ? "long" : "short";
    }

    /** Hướng position -> hướng lệnh close */
    private getCloseSideForPos(pos: TPosition): TSide {
        return this.getPosSide(pos) === "long" ? "short" : "long";
    }

    /**
     * contract: BTC_USDT
     */
    private async getInfoContract(contract: string) {
        let infoContract = this.infoContract.get(contract);
        if (!infoContract) {
            try {
                const { data } = await axios.get<TRes<TGetInfoContractRes>>(
                    `${BASE_URL}${ENDPOINT.CONTRACT.GET_INFO_CONTRACT}?contract=${contract}&source=gate`,
                );
                infoContract = data.data;
                // console.log(`getInfoCalContract: `, data.data);
                this.infoContract.set(contract, data.data);
            } catch (error) {
                console.log("getInfoCalContract: ", error);
            }
        }
        return infoContract;
    }

    private async getLastPrice(contract: string) {
        try {
            const { data } = await axios.get<TRes<number>>(`${BASE_URL}${ENDPOINT.HELPER.LAST_PRICE}/${contract}`);
            // console.log("getLastPrice: ", data.data);
            return data.data;
        } catch (error) {
            console.log("getLastPrice: ", error);
        }
    }

    // nếu giá vào không hợp lệ so với mark thì sẽ dùng mark làm base rồi tính tiếp tp
    private tpPrice(entry: number, tpPercent: number, side: TSide, tick: number, mark?: number): string {
        const dec = this.decimalsFromTick(tick);
        const ceilTick = (p: number) => Math.ceil(p / tick) * tick;
        const floorTick = (p: number) => Math.floor(p / tick) * tick;

        tpPercent = tpPercent / 100;
        const factor = side === "long" ? 1 + tpPercent : 1 - tpPercent;
        const roundDir = side === "long" ? ceilTick : floorTick; // làm tròn theo chiều đúng

        const compute = (base: number) => roundDir(base * factor);

        // 1) tính từ entry
        let target = compute(entry);

        // 2) nếu sai phía so với mark => dùng mark làm base
        if (Number.isFinite(mark as number)) {
            if (side === "long" && target <= (mark as number)) {
                target = compute(mark as number);
            } else if (side === "short" && target >= (mark as number)) {
                target = compute(mark as number);
            }
        }

        return target.toFixed(dec);
    }

    private decimalsFromTick(tick: number) {
        const s = String(tick);
        if (s.includes("e-")) return Number(s.split("e-")[1]);
        const i = s.indexOf(".");
        return i >= 0 ? s.length - i - 1 : 0;
    }

    /** Các contract có OPEN nhưng KHÔNG có position, kèm earliest riêng từng contract */
    private contractsToCancelWithEarliest() {
        const stats = this.openStatsByContract();
        if (stats.length === 0) this.clearStickies();
        return stats.filter(({ contract }) => {
            if (this.positions.has(contract)) {
                this.log(`${contract} có trong position => bỏ qua`);
                this.removeSticky(`timeout:${contract}`);
                return false;
            } else {
                return true;
            }
        });
    }

    /** Gom OPEN orders theo contract (reduce_only = false) + thống kê */
    private openStatsByContract() {
        const m = new Map<string, { earliest: number; latest: number; count: number }>();

        for (const o of this.orderOpens) {
            if (o.is_reduce_only) continue; // chỉ OPEN
            const c = o.contract.replace("/", "_");

            const rec = m.get(c);
            if (!rec) {
                m.set(c, { earliest: o.create_time, latest: o.create_time, count: 1 });
            } else {
                if (o.create_time < rec.earliest) rec.earliest = o.create_time;
                if (o.create_time > rec.latest) rec.latest = o.create_time;
                rec.count++;
            }
        }

        // [{ contract, earliest, latest, count }]
        return [...m.entries()].map(([contract, v]) => ({ contract, ...v }));
    }

    private clearStickies() {
        this.parentPort?.postMessage({ type: "bot:sticky:clear" });
    }

    private isTimedOutClearOpen(create_time_sec: number, contract: string) {
        const created = this.toSec(create_time_sec);
        const nowSec = Math.floor(Date.now() / 1000);

        this.sendLogUi(`⏰ ${contract}: ${nowSec - created} / ${this.settingUser.timeoutClearOpenSecond}`);
        this.setSticky(`timeout:${contract}`, `${contract}: ${nowSec - created} / ${this.settingUser.timeoutClearOpenSecond}`);

        return nowSec - created >= this.settingUser.timeoutClearOpenSecond;
    }

    private toSec(t: number | string) {
        return Math.floor(Number(t));
    }

    private setSticky(key: string, text: string) {
        const payload: StickySetPayload = { key, text, ts: Date.now() };
        this.parentPort?.postMessage({ type: "bot:sticky:set", payload });
    }

    private isCheckwhitelistEntryEmty() {
        if (this.whitelistEntry.length <= 0) {
            this.log(`whitelistEntry rỗng => không xử lý whitelistEntry`, this.whitelistEntry.length);
            return false;
        }
        return true;
    }

    private isCheckMaxOpenPO() {
        if (this.getLengthOrderInOrderOpensAndPosition() >= this.settingUser.maxTotalOpenPO) {
            this.log(`Đã đạt giới hạn maxTotalOpenPO >= không xử lý whitelistEntry`, {
                maxTotalOpenPO: this.settingUser.maxTotalOpenPO,
                lengthOrderInOrderOpensAndPosition: this.getLengthOrderInOrderOpensAndPosition(),
            });
            return false;
        }
        return true;
    }

    private getLengthOrderInOrderOpensAndPosition(): number {
        const pairs = new Set<string>();

        // 1) các lệnh OPEN đang treo (không reduce_only)
        for (const ord of this.orderOpens) {
            if (ord.is_reduce_only) continue;
            pairs.add(ord.contract.replace("/", "_"));
        }

        // 2) các position đang có
        for (const [, pos] of this.positions) {
            if (!pos || !pos.size) continue;
            pairs.add(pos.contract.replace("/", "_"));
        }

        const length = pairs.size;
        this.log(`lengthOrderInOrderOpensAndPosition: ${length}`);

        return length;
    }

    private isOrderExitsByContract(contract: string): boolean {
        const isExitsOrderOpens = !!this.orderOpens.find((item) => item.contract === contract.replace("_", "/") && !item.is_reduce_only);
        if (isExitsOrderOpens) this.log(`${contract} đã tồn tại trong orderOpens => bỏ qua | isExitsOrderOpens: ${isExitsOrderOpens}`);

        // console.log("contract: ", contract);
        const isExitsPosition = this.positions.has(contract);
        if (isExitsPosition) this.log(`${contract} tồn tại trong position => bỏ qua | isExitsPosition: ${isExitsPosition}`);

        const isExits = isExitsOrderOpens || isExitsPosition;

        return isExits;
    }

    private async getBidsAsks(contract: string, limit: number = 10) {
        const url = `https://www.gate.com/apiw/v2/futures/usdt/order_book?limit=${limit}&contract=${contract.replace("/", "_")}`;

        const { body, error, ok } = await this.gateFetch<TGateApiRes<TBidsAsks | null>>(url);
        if (ok === false || error || body === null) {
            const msg = `❌ Get Order Opens: ${error}`;
            throw new Error(msg);
        }

        const { code, data, message } = body;

        if (code >= 400 || code < 0) {
            const msg = `❌ getBidsAsks fail (code=${code}): ${message || "Unknown"}`;
            throw new Error(msg);
        }

        if (data === null) {
            const msg = `❌ getBidsAsks fail (data === null): ${message || "Unknown"}`;
            throw new Error(msg);
        }

        this.log(`✅ Get Bids & Asks [SUCCESS]: ${contract} | limit: ${limit}`);

        return data;
    }

    private async handleRoi(pos: TPosition): Promise<void> {
        const symbol = pos.contract.replace("/", "_");
        const info = await this.getInfoContract(symbol);
        if (!info) return;

        const size = Number(pos.size);
        const entryPrice = Number(pos.entry_price);
        const leverage = Number(pos.leverage);
        const quanto = Number(info.quanto_multiplier);
        const lastPrice = Number(await this.getLastPrice(symbol));
        const openTimeSec = Number(pos.open_time); // giây
        const nowMs = Date.now();

        // Bỏ qua nếu dữ liệu không hợp lệ
        if (!Number.isFinite(size) || size === 0) return;
        if (!Number.isFinite(entryPrice) || entryPrice <= 0) return;
        if (!Number.isFinite(leverage) || leverage <= 0) return;
        if (!Number.isFinite(quanto) || quanto <= 0) return;
        if (!Number.isFinite(lastPrice) || lastPrice <= 0) return;

        const initialMargin = (entryPrice * Math.abs(size) * quanto) / leverage;
        const unrealizedPnL = (lastPrice - entryPrice) * size * quanto;
        const returnPercent = (unrealizedPnL / initialMargin) * 100;

        const { stopLoss, timeoutEnabled, timeoutMs } = this.settingUser;
        const createdAtMs = openTimeSec > 0 ? openTimeSec * 1000 : nowMs;
        const isSL = returnPercent <= -stopLoss;
        const timedOut = timeoutEnabled && nowMs - createdAtMs >= timeoutMs;

        if (!isSL && !timedOut) return;

        // Lấy order book
        const book = await this.getBidsAsks(symbol);
        const bestBid = Number(book?.bids?.[0]?.p);
        const bestAsk = Number(book?.asks?.[0]?.p);
        if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) return;

        // Chọn giá maker đúng phía
        const tick = Number(info.order_price_round) || 0;
        const aggressiveTicks = 2; // có thể lấy từ setting
        const toFixed = (n: number) => {
            const dec = this.decimalsFromTick(tick || 0.00000001);
            return n.toFixed(dec);
        };

        let priceNum: number;
        if (size > 0) {
            // close long = SELL → đặt >= bestAsk để là maker
            priceNum = bestAsk + (tick * aggressiveTicks || 0);
        } else {
            // close short = BUY → đặt <= bestBid để là maker
            priceNum = bestBid - (tick * aggressiveTicks || 0);
        }
        const priceStr = toFixed(priceNum);

        const payload: TPayloadOrder = {
            contract: symbol,
            price: priceStr,
            size: this.flipSignStr(size),
            reduce_only: true,
        };

        try {
            // await this.openEntry(payload, "SL: Close");
            this.sendLogUi(
                [
                    `🧪 ROI DEBUG — ${symbol}`,
                    `  • side: ${size > 0 ? "long" : "short"}  size: ${size}`,
                    `  • entry: ${entryPrice}  last: ${lastPrice}  lev: ${leverage}x  quanto: ${quanto}`,
                    `  • PnL: ${unrealizedPnL.toFixed(6)}  IM: ${initialMargin.toFixed(6)}  ROI: ${returnPercent.toFixed(2)}%`,
                    `  • SL(threshold): -${stopLoss}%  → isSL=${isSL}`,
                    `  • timeout: ${timeoutEnabled}  age: ${((nowMs - createdAtMs) / 1000).toFixed(1)}s / ${(timeoutMs / 1000).toFixed(1)}s  → timedOut=${timedOut}`,
                    `  • orderbook: bestBid=${bestBid}  bestAsk=${bestAsk}  tick=${tick}  aggTicks=${aggressiveTicks}`,
                    `  • chosenPrice: ${priceStr}`,
                    `  • payload: ${JSON.stringify(payload)}`,
                ].join("\n"),
                "info",
            );
        } catch (error: any) {
            this.sendLogUi(`${error.message}`, "error");
        }
        return
    }

    private flipSignStr(n: number | string): string {
        const x = Number(n);
        if (!Number.isFinite(x)) throw new Error("size không hợp lệ");
        const y = -x;
        // tránh "-0"
        return (Object.is(y, -0) ? 0 : y).toString();
    }

    private setWhitelist(whiteList: TWhiteList) {
        this.whiteList = whiteList;
    }

    private setSettingUser(settingUser: TSettingUsers) {
        this.settingUser = settingUser;
    }

    private setUiSelector(settingUser: TUiSelector[]) {
        this.uiSelector = settingUser;
    }
}
