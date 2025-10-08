// bot.worker.ts
import { BASE_URL, IS_PRODUCTION } from "@/constant/app.constant";
import { ENDPOINT } from "@/constant/endpoint.constant";
import {
    createCodeStringCheckLogin,
    createCodeStringClickCancelAllOpen,
    createCodeStringClickClearAll,
    createCodeStringClickMarketPosition,
    createCodeStringClickTabOpenOrder,
    createCodeStringGetUid,
} from "@/javascript-string/logic-farm";
import { TAccount } from "@/types/account.type";
import { TRes } from "@/types/app.type";
import { TGateApiRes } from "@/types/base-gate.type";
import { TSide } from "@/types/base.type";
import { TBidsAsks } from "@/types/bids-asks.type";
import {
    StickySetPayload,
    TChangeLeverage,
    TDataInitBot,
    TDataOrder,
    TFectWorkRes,
    TGateClickCancelAllOpenRes,
    TGateFectMainRes,
    TGateOrderMainRes,
    THistoryAggregate,
    TOrderWorkRes,
    TPayloadFollowApi,
    TPayloadOrder,
    TUiSelectorOrder,
    TValueChangeLeverage,
} from "@/types/bot.type";
import { getSideRes } from "@/types/ccc.type";
import { TGetInfoContractRes } from "@/types/contract.type";
import { EStatusFixLiquidation } from "@/types/enum/fix-liquidation.enum";
import { EStatusFixStopLoss } from "@/types/enum/fix-stoploss.enum";
import { TDataFixLiquidation, TUpsertFixLiquidationReq } from "@/types/fix-liquidation.type";
import { TDataFixStopLoss, TDataFixStopLossHistoriesReq, TDataStopLossShouldFix, TUpsertFixStopLossReq } from "@/types/fix-stoploss.type";
import { TOrderOpen } from "@/types/order.type";
import { TPosition } from "@/types/position.type";
import { TSettingUsers } from "@/types/setting-user.type";
import { TTakeprofitAccount } from "@/types/takeprofit-account.type";
import { TUiSelector } from "@/types/ui-selector.type";
import { TWhiteList, TWhitelistEntry } from "@/types/white-list.type";
import { TWorkerData, TWorkerHeartbeat, TWorkLog } from "@/types/worker.type";
import axios from "axios";
import { LogFunctions } from "electron-log";
import { performance } from "node:perf_hooks";
import { parentPort } from "node:worker_threads";
import { calcSize, handleEntryCheckAll } from "./util-bot.worker";
import { TWhiteListMartingale } from "@/types/white-list-martingale.type";
import { TUid } from "@/types/uid.type";
import { TInfoGate } from "@/types/info-gate.type";

const FLOWS_API = {
    acounts: {
        url: "https://www.gate.com/apiw/v2/futures/usdt/accounts",
        method: "GET",
    },
    orders: {
        url: "https://www.gate.com/apiw/v2/futures/usdt/orders?contract=&status=open",
        method: "GET",
    },
    positions: {
        url: "https://www.gate.com/apiw/v2/futures/usdt/positions",
        method: "GET",
    },
    getUserInfo: {
        url: "https://www.gate.com/api/web/v1/rebate/get_user_info",
        method: "GET",
    },
};

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
            const payload: TWorkerData<TWorkLog> = {
                type: "bot:log",
                payload: {
                    level: "info",
                    text: "6) ✅ bot:init - received",
                },
            };
            parentPort?.postMessage(payload);
            if (!bot) {
                const dataInitBot: TDataInitBot = {
                    parentPort: parentPort!,
                    settingUser: msg.payload.settingUser,
                    uiSelector: msg.payload.uiSelector,
                    blackList: msg.payload.blackList,
                    whiteListMartingale: msg.payload.whiteListMartingale,
                    fixLiquidationInDB: msg.payload.fixLiquidationInDB,
                    fixStopLossQueueInDB: msg.payload.fixStopLossQueueInDB,
                    fixStopLossInDB: msg.payload.fixStopLossInDB,
                    uids: msg.payload.uids,
                    uidDB: msg.payload.uidDB,
                };
                bot = new Bot(dataInitBot);
            }
            break;
        default:
            bot?.handleEvent?.(msg); // chuyển tiếp cho bot
    }
});

export const GATE_TIMEOUT = "GATE_TIMEOUT";
const INSUFFICIENT_AVAILABLE = "INSUFFICIENT_AVAILABLE";
const TOO_MANY_REQUEST = "TOO_MANY_REQUEST";

class Bot {
    private count = 0;
    private running = false;
    private parentPort: import("worker_threads").MessagePort;
    private isStart = false;
    private orderOpens: TOrderOpen[] = [];
    private positions = new Map<string, TPosition>(); // "BTC_USDT"
    private changedLaveragelist = new Map<string, TValueChangeLeverage>();
    private settingUser: TSettingUsers;
    private uiSelector: TUiSelector[];
    private whitelistEntry: TWhitelistEntry[] = [];
    private whiteList: TWhiteList = {};
    private infoContract = new Map<string, TGetInfoContractRes>();
    private blackList: string[] = [];
    private whiteListMartingale: TWhiteListMartingale["symbol"][] = [];
    private nextOpenAt: number = 0;
    private accounts: TAccount[] = [];
    private rateCounter = new SlidingRateCounter();
    private rateMax: Record<WindowKey, number> = {
        "1s": 0,
        "1m": 0,
        "5m": 0,
        "15m": 0,
        "30m": 0,
        "1h": 0,
    };

    private dataFixLiquidation: TDataFixLiquidation;

    private rpcSequenceByKey = new Map<string, number>();

    private takeProfitAccount: TTakeprofitAccount | null = null;

    private dataFixStopLoss: TDataFixStopLoss;
    private fixStopLossQueue: TDataStopLossShouldFix[];

    private uidDB: TUid["uid"];

    private uidWeb: TUid["uid"] | null | undefined = undefined;

    constructor(dataInitBot: TDataInitBot) {
        this.parentPort = dataInitBot.parentPort;
        this.settingUser = dataInitBot.settingUser;
        this.uiSelector = dataInitBot.uiSelector;
        this.blackList = dataInitBot.blackList;
        this.whiteListMartingale = dataInitBot.whiteListMartingale;
        this.uidDB = dataInitBot.uidDB;

        // Fix Liquidation
        this.dataFixLiquidation = {
            dataLiquidationShouldFix: dataInitBot.fixLiquidationInDB?.data.dataLiquidationShouldFix || null,
            dataOrderOpenFixLiquidation: dataInitBot.fixLiquidationInDB?.data.dataOrderOpenFixLiquidation || null,
            dataCloseTP: dataInitBot.fixLiquidationInDB?.data.dataCloseTP || null,
            startTimeSec: dataInitBot.fixLiquidationInDB?.data.startTimeSec || null,
            stepFixLiquidation: dataInitBot.fixLiquidationInDB?.data.stepFixLiquidation || 0,
            inputUSDTFix: dataInitBot.fixLiquidationInDB?.data.inputUSDTFix || null,
            leverageFix: dataInitBot.fixLiquidationInDB?.data.leverageFix || null,
        };
        this.upsertFixLiquidation();

        // Fix Stop Loss
        if (dataInitBot.fixStopLossInDB && dataInitBot.fixStopLossInDB.isDone === false) {
            this.dataFixStopLoss = {
                dataStopLossShouldFix: dataInitBot.fixStopLossInDB.data.dataStopLossShouldFix,
                dataOrderOpenFixStopLoss: dataInitBot.fixStopLossInDB.data.dataOrderOpenFixStopLoss,
                dataCloseTP: dataInitBot.fixStopLossInDB.data.dataCloseTP,
                startTimeSec: dataInitBot.fixStopLossInDB.data.startTimeSec,
                stepFixStopLoss: dataInitBot.fixStopLossInDB.data.stepFixStopLoss,
                inputUSDTFix: dataInitBot.fixStopLossInDB.data.inputUSDTFix,
                leverageFix: dataInitBot.fixStopLossInDB.data.leverageFix,
            };
        } else {
            this.dataFixStopLoss = {
                dataStopLossShouldFix: null,
                dataOrderOpenFixStopLoss: null,
                dataCloseTP: null,
                startTimeSec: null,
                stepFixStopLoss: 0,
                inputUSDTFix: null,
                leverageFix: null,
            };
        }
        this.upsertFixStopLoss();

        this.fixStopLossQueue = dataInitBot.fixStopLossQueueInDB?.queue || [];
        this.sendFixStopLossQueue();

        this.run();
    }

    private async run() {
        if (this.running) return;
        this.running = true;
        this.parentPort.postMessage({ type: "bot:init:done", payload: true });

        // const infoGate = await this.getInfoGate();
        // this.infoGate = infoGate;

        for (;;) {
            const iterStart = performance.now();
            try {
                this.log("\n\n\n\n\n");
                this.log(`✅✅✅✅✅ ITER START ${this.count} | ${this.isStart} | ${this.running} =====`);
                await this.beforeEach();

                if (!this.uidWeb) continue;

                if (this.isStart) {
                    if (this.isNextPhase()) {
                        await this.handleNextPhase();
                        continue;
                    }

                    await this.setWhitelistEntry();
                    this.syncDataOrderOpenFixStopLoss();

                    // ===== 1) CREATE CLOSE ==============================================
                    await this.createTPClose();

                    // ===== 2) CLEAR OPEN =================================================
                    if (this.orderOpens.length > 0) {
                        const contractsToCancel = this.contractsToCancelWithEarliest();
                        for (const contract of contractsToCancel) {
                            if (this.isClearOpen(contract.earliest, contract.contract)) {
                                await this.clickCanelAllOpen(contract.contract);
                            }
                        }

                        // Cập nhật TP-close xen kẽ
                        await this.createTPClose();

                        this.log("🟢 ✅ Clear Open: done");
                    } else {
                        this.log("🟢 Clear Open: no order open");
                    }
                    console.log("\n\n");

                    await this.createLiquidationShouldFix();
                    this.createStopLossShouldFix();

                    // ===== 3) CREATE OPEN ===============================================
                    if (this.isHandleCreateOpen()) {
                        for (const whitelistItem of Object.values(this.whitelistEntry)) {
                            const { symbol, sizeStr, side, lastPriceGate, quanto_multiplier } = whitelistItem;

                            if (this.isCheckLimit()) {
                                this.logWorker.info(`🔵 Create Open: skip rate limit hit`);
                                break;
                            }

                            if (this.isCheckDelayForPairsMs()) {
                                this.logWorker.info(`🔵 Create Open: skip (delayForPairsMs ${this.cooldownLeft()}ms)`);
                                break;
                            }

                            // nếu symbol đó đã tồn tại trong orderOpens -> bỏ qua
                            if (this.isOrderExitsByContract(symbol)) {
                                this.logWorker.info(`🔵 Create Open: skip ${symbol} (already exists)`);
                                continue;
                            }

                            // nếu symbol tồn tại trong blackList -> bỏ qua
                            if (this.isExitsBlackList(symbol)) {
                                continue;
                            }

                            const bidsAsks = await this.getBidsAsks(symbol);
                            const prices = bidsAsks[side === "long" ? "bids" : "asks"].slice(0, IS_PRODUCTION ? 3 : 1);
                            const price = prices[IS_PRODUCTION ? 1 : 0].p;

                            let isCreateOrderOpenFix: boolean;

                            if (this.isFixStopLoss()) {
                                isCreateOrderOpenFix = await this.createOrderOpenFixStopLoss(symbol, price, lastPriceGate, quanto_multiplier, side);
                            } else {
                                isCreateOrderOpenFix = await this.createOrderOpenFixLiquidation(symbol, price, lastPriceGate, quanto_multiplier);
                            }

                            if (isCreateOrderOpenFix) continue;

                            // nếu đã max thì không vào thoát vòng lặp
                            if (this.isCheckMaxOpenPO()) {
                                this.logWorker.info(`🔵 Create Open: skip MaxOpenPO ${this.getLengthOrderInOrderOpensAndPosition()}`);
                                break;
                            }

                            const size = IS_PRODUCTION ? sizeStr : `1`;
                            // const size = sizeStr;

                            const ok = await this.changeLeverage(symbol, this.settingUser.leverage);
                            if (!ok) continue;

                            for (const price of prices) {
                                const payloadOpenOrder: TPayloadOrder = {
                                    contract: symbol,
                                    size: side === "long" ? size : `-${size}`,
                                    price: price.p,
                                    reduce_only: false,
                                };
                                try {
                                    await this.openEntry(payloadOpenOrder, `Open`);
                                } catch (error: any) {
                                    if (error?.message === INSUFFICIENT_AVAILABLE) {
                                        throw new Error(error);
                                    }
                                    if (this.isTimeoutError(error)) {
                                        throw new Error(error);
                                    }
                                    this.logWorker.error(error?.message);
                                    continue;
                                }
                            }

                            // cập nhật TP-close
                            await this.createTPClose();

                            // ✅ đặt cooldown cho symbol này sau khi xử lý xong
                            this.postponePair(this.settingUser.delayForPairsMs);
                        }
                    }
                    console.log("\n\n");

                    await this.checkDataFixLiquidationIsDone();
                    await this.checkDataFixStopLossIsDone();

                    // ===== 4) SL / ROI ===================================================
                    if (this.isHandleSL()) {
                        for (const [, pos] of this.positions) {
                            if (this.isExitsBlackList(pos.contract)) {
                                continue;
                            }
                            await this.handleRoi(pos);
                        }
                        await this.createTPClose();
                    }
                    console.log("\n\n");
                } else {
                    this.log("isStart=false → skip all work");
                }
            } catch (err: any) {
                this.logWorker.error(err?.message);
                if (this.isTimeoutError(err)) {
                    this.reloadWebContentsViewRequest();
                }
            } finally {
                const dt = Math.round(performance.now() - iterStart);
                this.count += 1;
                this.log(`✅✅✅✅✅ ITER END (took ${dt}ms) =====`, "");
                await this.sleep(1000);
            }
        }
    }

    private async createTPClose() {
        // ===== 1) CREATE TP CLOSE =====
        if (this.positions.size > 0) {
            const payloads = await this.getCloseOrderPayloads(); // 1 bước: tính + build payload

            for (const p of payloads) {
                try {
                    if (this.isExitsBlackList(p.contract)) {
                        continue;
                    }

                    const isFixStopLoss = this.isFixStopLoss();
                    const leverageForFix = isFixStopLoss ? this.getLeverageStopLossForFix(p.contract) : this.getLeverageLiquidationForFix(p.contract);

                    let leverage = leverageForFix || this.settingUser.leverage;

                    const ok = await this.changeLeverage(p.contract.replace("/", "_"), leverage);
                    if (!ok) continue;

                    const res = await this.openEntry(p, `TP: Close`);

                    if (leverageForFix) {
                        if (isFixStopLoss) {
                            this.dataFixStopLoss.dataCloseTP = {
                                contract: p.contract,
                                id_string: res.id_string,
                                price: res.price,
                                fill_price: res.fill_price,
                                create_time: res.create_time,
                            };
                            this.upsertFixStopLoss();
                        } else {
                            this.dataFixLiquidation.dataCloseTP = {
                                contract: p.contract,
                                id_string: res.id_string,
                                price: res.price,
                                fill_price: res.fill_price,
                                create_time: res.create_time,
                            };
                            this.upsertFixLiquidation();
                        }
                    }
                } catch (error: any) {
                    if (error?.message === INSUFFICIENT_AVAILABLE) {
                        throw new Error(error);
                    }
                    if (this.isTimeoutError(error)) {
                        throw new Error(error);
                    }
                    this.logWorker.error(error?.message);
                    continue;
                }
            }
        } else {
            this.log("🩵 Create Close: no positions");
        }
        console.log("\n\n");
    }

    private async beforeEach() {
        this.heartbeat();
        this.rateCounterSendRenderer();
        await this.getUid();
        this.checkUid()
        // await this.checkLoginGate();
        // await this.handleGetInfoGate();
        // await this.checkUid();
        // this.getSideCCC();
        // this.logWorker.log(`[RATE] hit limit; counts so far: ${JSON.stringify(this.rateCounter.counts())}`);
        // console.log(`positions`, Object(this.positions).keys());
        // console.log(`orderOpens`, this.orderOpens);
        // console.log(`settingUser`, this.settingUser);
        // console.log("startTimeSec", this.startTimeSec);
        // console.log("stepFixLiquidation", this.stepFixLiquidation);
        // console.log("dataFixLiquidation", this.dataFixLiquidation);
        // console.log("dataFixStopLoss", this.dataFixStopLoss);
        // console.log("fixStopLossQueue", this.fixStopLossQueue);
        // console.log("whiteListMartingale", this.whiteListMartingale);
        // console.log("uidDB", this.uidDB);
    }

    private heartbeat() {
        const payload: TWorkerData<TWorkerHeartbeat> = {
            type: "bot:heartbeat",
            payload: {
                ts: Date.now(),
                isStart: this.isStart,
                isRunning: this.running,
            },
        };
        this.parentPort?.postMessage(payload);
    }

    private rateCounterSendRenderer() {
        const payload: TWorkerData<Record<WindowKey, number>> = {
            type: "bot:rateCounter",
            payload: this.rateCounter.counts(),
        };
        this.parentPort?.postMessage(payload);
    }

    handleEvent(msg: any) {
        switch (msg.type) {
            case "bot:start":
                this.start();
                break;

            case "bot:stop":
                this.stop();
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

            case "bot:blackList":
                this.setBlackList(msg.payload);
                break;

            case "bot:whiteListMartingale":
                this.setWhiteListMartingale(msg.payload);
                break;

            case "bot:reloadWebContentsView:Response":
                this.reloadWebContentsViewResponse(msg.payload);
                break;

            case "bot:followApi":
                this.handleFollowApi(msg.payload);
                break;

            case "bot:reloadWebContentsView":
                this.reloadWebContentsViewRequest();
                break;

            case "bot:rateMax:set":
                this.handleMaxRate(msg);
                break;

            case "bot:takeProfitAccount":
                this.setTakeProfitAccount(msg);
                break;

            case "bot:removeFixStopLossQueue":
                this.removeFixStopLossQueue(msg);
                break;

            default:
                break;
        }
    }

    private start(isNextPhase = true) {
        this.isStart = true;
        this.parentPort?.postMessage({ type: "bot:start", payload: { isStart: this.isStart, isNextPhase } });
        this.logWorker.info("🟢 Start");
    }

    private stop() {
        this.isStart = false;
        this.parentPort?.postMessage({ type: "bot:stop", payload: { isStart: this.isStart } });
        this.logWorker.info("🔴 Stop");
    }

    private sleep(ms: number) {
        return new Promise((r) => setTimeout(r, ms));
    }

    private isHandleCreateOpen(): boolean {
        // return false;
        const isWhiteListEntryEmpty = this.isCheckWhitelistEntryEmty();
        if (isWhiteListEntryEmpty) {
            this.logWorker.info(`🔵 Create Open: skip White list entry empty: ${this.whitelistEntry.length}`);
            return false;
        }

        return true;
    }

    private setBlackList(blackList: string[]) {
        this.blackList = blackList;
    }

    private setWhiteListMartingale(whiteListMartingale: TWhiteListMartingale["symbol"][]) {
        this.whiteListMartingale = whiteListMartingale;
    }

    private setOrderOpens(orderOpens: TOrderOpen[]) {
        this.orderOpens = orderOpens || [];
        this.syncDataOrderOpenFixLiquidation(orderOpens);
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
                done({ ok: false, body: null, error: GATE_TIMEOUT });
            }, timeoutMs);

            // 3) gửi sau
            port.postMessage({ type: "bot:fetch", payload: { url, init, reqId, timeoutMs } });
        });
    }

    private log(step: string, data?: any) {
        const ts = new Date().toISOString();
        if (data !== undefined) console.log(`[Bot][${ts}] ${step}`, data);
        else console.log(`[Bot][${ts}] ${step}`);
    }

    private async changeLeverage(symbol: string, leverageNumber: number): Promise<boolean> {
        const changedLeverage = this.changedLaveragelist.get(symbol);
        if (changedLeverage && changedLeverage.leverage === leverageNumber) {
            // this.log(`✅ Change Leverage [EXISTS] ${symbol} skip => `, this.changedLaveragelist);
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
            this.logWorker.error(msg);
            return false;
        }

        if (data === null || data === undefined) {
            const msg = `❌ Change Leverage: data is ${data}`;
            throw new Error(msg);
        }

        if (data?.[0]?.leverage !== leverageString || data?.[1]?.leverage !== leverageString) {
            const msg = `❌ Change Leverage: ${symbol} | mismatched leverage`;
            this.logWorker.error(msg);
            return false;
        }

        this.changedLaveragelist.delete(symbol);
        this.changedLaveragelist.set(symbol, { symbol, leverage: leverageNumber });
        const msg = `✅ Change Leverage: ${symbol} | ${leverageString}`;
        this.logWorker.info(msg);

        return true;
    }

    private async openEntry(payload: TPayloadOrder, label: string) {
        if (Number(this.accounts[0].available || 0) <= 0) {
            const msg = `❌ ${payload.contract} - ${label} ${Number(payload.size) >= 0 ? "long" : "short"} | ${payload.size} | ${payload.price}: ${INSUFFICIENT_AVAILABLE}`;
            this.logWorker.error(msg);
            throw new Error(INSUFFICIENT_AVAILABLE);
        }

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

        this.rateCounter.startAttempt();

        const { body, error, ok } = await this.createOrder<TGateApiRes<TOrderOpen | null>>(payload, dataSelector);

        if ((body as any)?.label === TOO_MANY_REQUEST) {
            // this.rateCounter.rollback(ticket); // không tính lần attempt đụng limit
            // this.rateCounter.stop(); // từ giờ ngừng đếm

            const msg = `❌ ${payload.contract} - ${label} ${Number(payload.size) >= 0 ? "long" : "short"} | ${payload.size} | ${payload.price}: ${body?.message || TOO_MANY_REQUEST}`;
            this.logWorker.error(msg);

            this.logWorker.warn(`[RATE] hit limit; counts so far: ${JSON.stringify(this.rateCounter.counts())}`);

            throw new Error(msg);
        }

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
        this.logWorker.info(status);

        return body.data;
    }

    private seqOrder = 0;

    private async createOrder<T>(payload: TPayloadOrder, dataSelector: TUiSelectorOrder, timeoutMs = 10_000): Promise<TOrderWorkRes<T>> {
        const reqOrderId = ++this.seqOrder;
        const port = this.parentPort!;

        const tag = `O${reqOrderId}`; // nhãn theo dõi trong log
        const t0 = Date.now();

        // this.sendLogUi(`[${tag}] start order ${payload.contract} size=${payload.size} price=${payload.price}`);

        return new Promise<TOrderWorkRes<T>>((resolve) => {
            let settled = false;
            let timer: NodeJS.Timeout;

            const done = (r: TFectWorkRes<T>, note?: string) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                try {
                    port.off("message", onMsg);
                } catch {}
                const dt = Date.now() - t0;
                // if (note) this.sendLogUi(`[${tag}] ${note} • dt=${dt}ms`, r.ok ? "info" : "error");
                resolve(r);
            };

            const onMsg = (m: any) => {
                try {
                    if (m?.type !== "bot:order:res") return;
                    if (m.payload?.reqOrderId !== reqOrderId) return;

                    const p: TGateOrderMainRes = m.payload;
                    if (!p.ok) return done({ ok: false, body: null, error: p.error || "Order failed" }, "main→order:res !ok");

                    let parsed: T;
                    try {
                        parsed = JSON.parse(p.bodyText) as T;
                    } catch (e) {
                        return done({ ok: false, body: null, error: `Invalid JSON from Order: ${String(e)}` }, "parse:fail");
                    }

                    return done({ ok: true, body: parsed, error: null });
                } catch (e) {
                    return done({ ok: false, body: null, error: `Order handler error: ${String(e)}` }, "handler:error");
                }
            };

            // 1) nghe trước
            port.on("message", onMsg);

            // 2) timeout RPC (phòng main không hồi)
            timer = setTimeout(() => {
                done({ ok: false, body: null, error: "Order rpc timeout" }, "timeout");
            }, timeoutMs);

            const data: TWorkerData<TDataOrder> = {
                type: "bot:order",
                payload: {
                    reqOrderId,
                    payloadOrder: payload,
                    selector: dataSelector,
                },
            };

            // this.sendLogUi(`[${tag}] post to main`);

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

        const stringClickTabOpenOrder = createCodeStringClickTabOpenOrder({
            buttonTabOpenOrder: selectorButtonTabOpenOrder,
        });

        const { body, error, ok } = await this.sendIpcRpc<boolean | null>({
            sequenceKey: "clickTabOpenOrder",
            requestType: "bot:clickTabOpenOrder",
            responseType: "bot:clickTabOpenOrder:res",
            idFieldName: "reqClickTabOpenOrderId",
            buildPayload: (requestId) => ({
                reqClickTabOpenOrderId: requestId,
                stringClickTabOpenOrder,
            }),
            timeoutMs: 10_000,
        });

        if (!ok || error || body == null) {
            throw new Error(`❌ Click Tab Open Order error: ${error ?? "unknown"}`);
        }
        if (body === false) {
            throw new Error(`❌ Click Tab Open Order body: false`);
        }

        return body;
    }

    private async clickCanelAllOpen(contract: string) {
        await this.clickTabOpenOrder();

        const selectorTableOrderPanel = this.uiSelector?.find((item) => item.code === "tableOrderPanel")?.selectorValue;

        if (!selectorTableOrderPanel) {
            this.log(`🟢 Not found selector`, { selectorTableOrderPanel });
            throw new Error(`Not found selector`);
        }

        const stringClickCanelAllOpen = createCodeStringClickCancelAllOpen({
            contract: contract.replace("/", "").replace("_", ""),
            tableOrderPanel: selectorTableOrderPanel,
        });

        const { body, error, ok } = await this.sendIpcRpc<TGateClickCancelAllOpenRes["body"]>({
            sequenceKey: "clickCanelAllOpen",
            requestType: "bot:clickCanelAllOpen",
            responseType: "bot:clickCanelAllOpen:res",
            idFieldName: "reqClickCanelAllOpenOrderId",
            buildPayload: (requestId) => ({
                reqClickCanelAllOpenOrderId: requestId,
                stringClickCanelAllOpen,
            }),
            timeoutMs: 10_000,
        });

        if (!ok || error || body == null) {
            throw new Error(`🟢 ❌ Click Cancel All Order error: ${error ?? "unknown"} ${body} ${ok}`);
        }

        this.logWorker.info(`✅ ${contract} Cancel All Open: ${body.clicked}`);
        this.removeSticky(`timeout:${contract}`);

        return body;
    }

    private async clickMarketPostion(symbol: string, side: TSide) {
        const selectorWrapperPositionBlocks = this.uiSelector?.find((item) => item.code === "wrapperPositionBlocks")?.selectorValue;
        const selectorButtonTabPosition = this.uiSelector?.find((item) => item.code === "buttonTabPosition")?.selectorValue;

        if (!selectorWrapperPositionBlocks || !selectorButtonTabPosition) {
            this.log(`🟢 Not found selector`, { selectorWrapperPositionBlocks, selectorButtonTabPosition });
            throw new Error(`Not found selector`);
        }

        const stringClickMarketPosition = createCodeStringClickMarketPosition({
            symbol: symbol.replace("/", "").replace("_", ""),
            side: side,
            selector: {
                wrapperPositionBlocks: selectorWrapperPositionBlocks,
                buttonTabPosition: selectorButtonTabPosition,
            },
        });

        const { body, error, ok } = await this.sendIpcRpc<TGateClickCancelAllOpenRes["body"]>({
            sequenceKey: "clickMarketPosition",
            requestType: "bot:clickMarketPosition",
            responseType: "bot:clickMarketPosition:res",
            idFieldName: "reqClickMarketPositionId",
            buildPayload: (requestId) => ({
                reqClickMarketPositionId: requestId,
                stringClickMarketPosition,
            }),
            timeoutMs: 10_000,
        });

        if (!ok || error || body == null) {
            throw new Error(`🟢 ❌ Click Market Position error: ${error ?? "unknown"} ${body} ${ok}`);
        }

        this.logWorker.info(`✅ 🤷 ${symbol} Click StopLoss Market Position`);
        return body;
    }

    private async clickClearAll() {
        const selectorButtonTabPosition = this.uiSelector?.find((item) => item.code === "buttonTabPosition")?.selectorValue;
        const selectorButtonCloseAllPosition = this.uiSelector?.find((item) => item.code === "buttonCloseAllPosition")?.selectorValue;

        const selectorButtonTabOpenOrder = this.uiSelector?.find((item) => item.code === "buttonTabOpenOrder")?.selectorValue;
        const selectorButtonCloseAllOpenOrder = this.uiSelector?.find((item) => item.code === "buttonCloseAllOpenOrder")?.selectorValue;

        if (!selectorButtonTabPosition || !selectorButtonCloseAllPosition || !selectorButtonTabOpenOrder || !selectorButtonCloseAllOpenOrder) {
            this.logWorker.info(`❌ Not found selector clickClearAll`);
            throw new Error(`Not found selector`);
        }

        const stringClickClearAll = createCodeStringClickClearAll({
            buttonTabPosition: selectorButtonTabPosition,
            buttonCloseAllPosition: selectorButtonCloseAllPosition,
            buttonTabOpenOrder: selectorButtonTabOpenOrder,
            buttonCloseAllOpenOrder: selectorButtonCloseAllOpenOrder,
        });

        const { body, error, ok } = await this.sendIpcRpc<boolean>({
            sequenceKey: "clickClearAll",
            requestType: "bot:clickClearAll",
            responseType: "bot:clickClearAll:res",
            idFieldName: "reqClickClearAllId",
            buildPayload: (requestId) => ({
                reqClickClearAllId: requestId,
                stringClickClearAll,
            }),
            timeoutMs: 10_000,
        });

        if (!ok || error || body == null) {
            throw new Error(`❌ Click Clear All error: ${error ?? "unknown"} ${body} ${ok}`);
        }

        this.logWorker.info(`✅ Click Clear All`);

        return body;
    }

    private removeSticky(key: string) {
        this.parentPort?.postMessage({ type: "bot:sticky:remove", payload: { key } });
    }

    private async setWhitelistEntry() {
        const whiteListArr = Object.values(this.whiteList);
        if (whiteListArr.length === 0) {
            this.whitelistEntry = [];
            return;
        }

        this.whitelistEntry = []; // cho bot

        const sideCCC = await this.getSideCCC();

        for (const whitelistItem of whiteListArr) {
            const { errString, qualified, result } = handleEntryCheckAll({
                whitelistItem,
                settingUser: this.settingUser,
                sideCCC,
            });

            if (errString) {
                this.logWorker.error(errString);
                continue;
            } else if (qualified && result && result.side) {
                this.whitelistEntry.push({
                    symbol: result.symbol,
                    sizeStr: result.sizeStr,
                    side: result.side,
                    askBest: result.askBest,
                    bidBest: result.bidBest,
                    order_price_round: result.order_price_round,
                    lastPriceGate: result.lastPriceGate,
                    quanto_multiplier: result.quanto_multiplier,
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
                this.logWorker.error(`❌ getCloseOrderPayloads: infoContract not found: ${contract}`);
                continue;
            }
            const tickSize = infoContract.order_price_round;

            // tính TP theo phía của POSITION (long -> +%, short -> -%)
            const entry_price = Number(pos.entry_price);
            const takeProfit = this.settingUser.takeProfit;
            const sideFortpPrice = this.getPosSide(pos);

            const lastPrice = await this.getLastPrice(contract);
            if (!lastPrice) {
                this.logWorker.error(`❌ getLastPrice: lastPrice not found: ${contract}`);
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
                this.log(`🟢 ${contract} có trong position => bỏ qua`);
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

    private toSeconds(input: number): number {
        const n = Number(input);
        if (!Number.isFinite(n) || n <= 0) return 0;
        // nếu lớn hơn ~ 10^11 thì coi là milli-giây (Unix ms)
        return n > 1e11 ? Math.floor(n / 1000) : Math.floor(n);
    }

    private isClearOpen(createdAtRaw: number, contract: string): boolean {
        const createdSec = this.toSec(createdAtRaw);
        const nowSec = Math.floor(Date.now() / 1000);

        const timeoutLimit = Math.max(0, Number(this.settingUser.timeoutClearOpenSecond) || 0);
        const elapsed = Math.max(0, nowSec - createdSec);

        // log rõ ràng + đơn vị giây
        // this.logWorker.info(`⏰ ${contract}: ${elapsed}s / ${timeoutLimit}s`);
        this.setSticky(`timeout:${contract}`, `${contract}: ${elapsed}s / ${timeoutLimit}s`);

        return elapsed >= timeoutLimit;
    }

    private toSec(t: number | string) {
        return Math.floor(Number(t));
    }

    private setSticky(key: string, text: string) {
        const payload: StickySetPayload = { key, text, ts: Date.now() };
        this.parentPort?.postMessage({ type: "bot:sticky:set", payload });
    }

    private isCheckWhitelistEntryEmty() {
        if (this.whitelistEntry.length <= 0) {
            return true;
        }
        return false;
    }

    private isCheckMaxOpenPO() {
        const lengthOrderInOrderOpensAndPosition = this.getLengthOrderInOrderOpensAndPosition();
        if (lengthOrderInOrderOpensAndPosition >= this.settingUser.maxTotalOpenPO) {
            return true;
        }
        return false;
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

        return length;
    }

    private isOrderExitsByContract(contract: string): boolean {
        const isExitsOrderOpens = !!this.orderOpens.find((item) => item.contract === contract.replace("_", "/") && !item.is_reduce_only);
        if (isExitsOrderOpens) this.log(`🔵 ${contract} đã tồn tại trong orderOpens => bỏ qua | isExitsOrderOpens: ${isExitsOrderOpens}`);

        // console.log("contract: ", contract);
        const isExitsPosition = this.positions.has(contract);
        if (isExitsPosition) this.log(`🔵 ${contract} tồn tại trong position => bỏ qua | isExitsPosition: ${isExitsPosition}`);

        const isExits = isExitsOrderOpens || isExitsPosition;

        return isExits;
    }

    private isExitsBlackList(contract: string): boolean {
        // console.log({ blacklist: this.blackList });
        const isExits = this.blackList.includes(contract.replace("/", "_"));
        // if (isExits) this.logWorker.info(`🔵 ${contract} Exits In BlackList => continue`);
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

        // this.log(`✅ Get Bids & Asks [SUCCESS]: ${contract} | limit: ${limit}`);

        return data;
    }

    // 1) Lấy toàn bộ lệnh close (reduce_only) đang mở cho 1 symbol
    private getOpenCloseOrdersBySymbol(symbol: string): TOrderOpen[] {
        const pos = this.positions.get(symbol.replace("/", "_")); // "BTC/USDT" -> "BTC_USDT"
        if (!pos) return [];
        return this.orderOpens.filter((o) => this.isCloseOrderForPosition(pos, o));
    }

    // 2) Phân biệt SL hay TP dựa trên vị thế & giá so với entry
    //    long:  SL khi price <= entry ; TP khi price >= entry
    //    short: SL khi price >= entry ; TP khi price <= entry
    private isSLCloseOrderForPosition(pos: TPosition, ord: TOrderOpen): boolean {
        if (!this.isCloseOrderForPosition(pos, ord)) return false;
        const price = Number((ord as any).price);
        const entry = Number(pos.entry_price);
        const side = this.getPosSide(pos);
        if (!Number.isFinite(price) || !Number.isFinite(entry)) return false;

        if (side === "long") return price <= entry;
        else return price >= entry;
    }

    /**
     * Từ các lệnh TP (reduce_only, cùng phía đóng với position),
     * tạo payload mới với price = L2 của orderbook (bids[1] hoặc asks[1]),
     * còn lại giữ nguyên (contract/size/reduce_only).
     */
    private async buildClosePayloadsFromExistingTP(symbol: string, pos: TPosition): Promise<TPayloadOrder[]> {
        // 1) lấy info & orderbook
        const info = await this.getInfoContract(symbol);
        if (!info) {
            this.logWorker.error(`❌ buildClosePayloadsFromExistingTP: infoContract not found: ${symbol}`);
            return [];
        }

        // 3) lọc các lệnh close hiện có theo symbol rồi loại SL → chỉ lấy TP
        const all = this.getOpenCloseOrdersBySymbol(symbol);
        const takeProfitArr = all.filter((o) => !this.isSLCloseOrderForPosition(pos, o));

        if (takeProfitArr.length === 0) {
            this.logWorker.info(`${symbol} haved SL orders, skip...`);
            return [];
        }
        // console.log("takeProfitArr: ", takeProfitArr);

        const book = await this.getBidsAsks(symbol);
        // console.dir({ book }, { depth: null, colors: true });
        const bestBidL2 = Number(book?.bids?.[1]?.p ?? book?.bids?.[0]?.p);
        const bestAskL2 = Number(book?.asks?.[1]?.p ?? book?.asks?.[0]?.p);
        if (!Number.isFinite(bestBidL2) || !Number.isFinite(bestAskL2)) {
            this.logWorker.error(`❌ buildClosePayloadsFromExistingTP: invalid L2 book for ${symbol}`);
            return [];
        }

        // 2) xác định phía phải đóng theo position

        // 4) map thành payload: giữ nguyên size/reduce_only/contract (đổi "/" -> "_"), chỉ thay price
        const payloads: TPayloadOrder[] = takeProfitArr.map((orderTakeProfit) => {
            const posSide: "long" | "short" = Number(orderTakeProfit.size) > 0 ? "long" : "short";
            const price = posSide === "long" ? bestBidL2 : bestAskL2; // SELL dùng bid L2, BUY dùng ask L2
            const sizeStr = String(orderTakeProfit.size);
            return {
                contract: symbol,
                price: String(price),
                size: sizeStr,
                reduce_only: true, // TP close luôn là reduce_only
            };
        });

        return payloads;
    }

    private async handleRoi(pos: TPosition): Promise<void> {
        const symbol = pos.contract.replace("/", "_");

        const info = await this.getInfoContract(symbol);
        if (!info) {
            this.logWorker.error(`🟣 ❌ SL ${symbol}: Get info contract fail`);
            return;
        }

        const size = Number(pos.size);
        const entryPrice = Number(pos.entry_price);
        const leverage = Number(pos.leverage);
        const quanto = Number(info.quanto_multiplier);
        const lastPrice = Number(await this.getLastPrice(symbol));
        const openTimeSec = Number(pos.open_time); // giây
        const nowMs = Date.now();

        // Bỏ qua nếu dữ liệu không hợp lệ
        if (!Number.isFinite(size) || size === 0) {
            this.logWorker.error(`🟣 ❌ SL ${symbol}: Get size ${size} contract fail`);
            return;
        }
        if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
            this.logWorker.error(`🟣 ❌ SL ${symbol}: Get entryPrice ${entryPrice} contract fail`);
            return;
        }
        if (!Number.isFinite(leverage) || leverage <= 0) {
            this.logWorker.error(`🟣 ❌ SL ${symbol}: Get leverage ${leverage} contract fail`);
            return;
        }
        if (!Number.isFinite(quanto) || quanto <= 0) {
            this.logWorker.error(`🟣 ❌ SL ${symbol}: Get quanto ${quanto} contract fail`);
            return;
        }
        if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
            this.logWorker.error(`🟣 ❌ SL ${symbol}: Get lastPrice ${lastPrice} contract fail`);
            return;
        }

        // let countSLROI = this.listSLROIFailed.get(symbol);
        // if (!countSLROI) {
        //     this.listSLROIFailed.set(symbol, { symbol: symbol, count: 0, side: size > 0 ? "long" : "short" });
        // }

        const initialMargin = (entryPrice * Math.abs(size) * quanto) / leverage;
        const unrealizedPnL = (lastPrice - entryPrice) * size * quanto;
        const returnPercent = (unrealizedPnL / initialMargin) * 100;

        const { stopLoss, timeoutEnabled, timeoutMs } = this.settingUser;
        const createdAtMs = openTimeSec > 0 ? openTimeSec * 1000 : nowMs;
        const isSL = returnPercent <= -stopLoss;
        const isTimedOut = timeoutEnabled && nowMs - createdAtMs >= timeoutMs;

        this.logWorker.info(`🟣 SL ${symbol}: ${returnPercent.toFixed(2)}%/-${stopLoss}% | isSL=${isSL} && isTimedOut=${isTimedOut}`);

        if (!isSL && !isTimedOut) {
            return;
        }

        // this.logWorker.info(
        //     [
        //         `🟣 ${symbol}`,
        //         `sl: ${returnPercent.toFixed(2)}%/-${stopLoss}%  → ${isSL}`,
        //         `timeout: ${timeoutEnabled ? "ON" : "OFF"} (${((nowMs - createdAtMs) / 1000).toFixed(1)}s / ${(timeoutMs / 1000).toFixed(1)}s) → ${isTimedOut}`,
        //         `${size > 0 ? "long" : "short"}  ${size}`,
        //         // `entry: ${entryPrice}  last: ${lastPrice}  lev: ${leverage}x  quanto: ${quanto}`,
        //     ].join(" | "),
        // );

        await this.clickMarketPostion(pos.contract, Number(pos.size) > 0 ? "long" : "short");

        this.handlePushFixStopLossQueue(pos);

        // const payloads = await this.buildClosePayloadsFromExistingTP(symbol, pos);
        // // this.logWorker.info(`🟣 SL Close Payloads: ${JSON.stringify(payloads)}`);

        // for (const payload of payloads) {
        //     // this.logWorker.info(`🟣 SL Close Payloads: ${JSON.stringify(payload)}`);
        //     try {
        //         const ok = await this.changeLeverage(symbol, this.settingUser.leverage);
        //         if (!ok) continue;
        //         await this.openEntry(payload, "SL: Close");
        //         this.listSLROIFailed.delete(symbol);
        //     } catch (error: any) {
        //         if (error?.message === INSUFFICIENT_AVAILABLE) {
        //             throw new Error(error);
        //         }
        //         if (this.isTimeoutError(error)) {
        //             throw new Error(error);
        //         }

        //         this.logWorker.error(`🟣 ${error.message}`);

        //     }
        // }

        // for (const [key, value] of this.listSLROIFailed) {
        //     if (value.count >= 3) {
        //         this.logWorker.info(`🟣 SL Close Failed: ${key} | ${value.count} | ${value.side}`);
        //     }
        // }

        return;
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

    private reloadWebContentsViewRequest() {
        this.logWorker.info("🔄 Reload WebContentsView Request");
        let isStop = false;
        if (this.isStart) {
            this.stop();
            isStop = true;
        }
        this.parentPort?.postMessage({ type: "bot:reloadWebContentsView:Request", payload: { isStop } });
    }

    private async reloadWebContentsViewResponse({ isStop }: { isStop: boolean }) {
        this.logWorker.info("🔄 Reload WebContentsView Response");
        await this.sleep(1000);
        if (isStop) this.start(false);
        this.parentPort?.postMessage({ type: "bot:reloadWebContentsView", payload: true });
    }

    private handleFollowApi(payloadFollowApi: TPayloadFollowApi) {
        try {
            // console.log("handleFollowApi: ", payloadFollowApi);

            const { url, method, bodyText } = payloadFollowApi;

            const key = `${method} ${url}`;

            switch (key) {
                case `${FLOWS_API.acounts.method} ${FLOWS_API.acounts.url}`:
                    const bodyAccounts: TGateApiRes<TAccount[] | null> = JSON.parse(bodyText);
                    this.handleAccountWebGate(bodyAccounts.data || []);
                    break;

                case `${FLOWS_API.getUserInfo.method} ${FLOWS_API.getUserInfo.url}`:
                    const bodyGetUserInfos: TGateApiRes<TAccount[] | null> = JSON.parse(bodyText);
                    console.log("bodyGetUserInfos: ", bodyGetUserInfos);
                    break;

                case `${FLOWS_API.orders.method} ${FLOWS_API.orders.url}`:
                    const bodyOrderOpens: TGateApiRes<TOrderOpen[] | null> = JSON.parse(bodyText);
                    this.setOrderOpens(bodyOrderOpens.data || []);
                    break;

                case `${FLOWS_API.positions.method} ${FLOWS_API.positions.url}`:
                    const bodyPositions: TGateApiRes<TPosition[] | null> = JSON.parse(bodyText);

                    if (!bodyPositions.data || !Array.isArray(bodyPositions.data)) break;

                    const result = bodyPositions.data.filter((pos) => Number(pos.size) !== 0);

                    this.replacePositions(result);
                    break;

                default:
                    break;
            }
        } catch (error) {
            this.logWorker.error(`❌ handleFollowApi: ${String(error)}`);
        }
    }

    private logWorker: LogFunctions = {
        info: (...params: any[]) => {
            const payload: TWorkerData<TWorkLog> = {
                type: "bot:log",
                payload: {
                    level: "info",
                    text: params.map(String).join(" "),
                },
            };
            parentPort?.postMessage(payload);
        },
        error: (...params: any[]) => {
            const payload: TWorkerData<TWorkLog> = {
                type: "bot:log",
                payload: {
                    level: "error",
                    text: params.map(String).join(" "),
                },
            };
            parentPort?.postMessage(payload);
        },
        warn: (...params: any[]) => {
            const payload: TWorkerData<TWorkLog> = {
                type: "bot:log",
                payload: {
                    level: "warn",
                    text: params.map(String).join(" "),
                },
            };
            parentPort?.postMessage(payload);
        },
        debug: (...params: any[]) => {
            const payload: TWorkerData<TWorkLog> = {
                type: "bot:log",
                payload: {
                    level: "debug",
                    text: params.map(String).join(" "),
                },
            };
            parentPort?.postMessage(payload);
        },
        log: (...params: any[]) => {
            const payload: TWorkerData<TWorkLog> = {
                type: "bot:log",
                payload: {
                    level: "info",
                    text: params.map(String).join(" "),
                },
            };
            parentPort?.postMessage(payload);
        },
        silly: (...params: any[]) => {
            const payload: TWorkerData<TWorkLog> = {
                type: "bot:log",
                payload: {
                    level: "silly",
                    text: params.map(String).join(" "),
                },
            };
            parentPort?.postMessage(payload);
        },
        verbose: (...params: any[]) => {
            const payload: TWorkerData<TWorkLog> = {
                type: "bot:log",
                payload: {
                    level: "verbose",
                    text: params.map(String).join(" "),
                },
            };
            parentPort?.postMessage(payload);
        },
    };

    private isTimeoutError(err: any): boolean {
        const TIMEOUT_PATTERNS = [
            /\btime(?:d\s*)?out\b/i, // timeout, timed out, time out
            /ERR_?TIMED_?OUT/i, // Chromium: net::ERR_TIMED_OUT
            /\bETIMEDOUT\b/i,
            /\bESOCKETTIMEDOUT\b/i,
            /\bECONNABORTED\b/i,
            /\bAbortError\b/i,
            /\bTimeoutError\b/i,
            /\bGATE_TIMEOUT\b/i,
        ];
        const msg = [
            String(err?.message ?? ""),
            String((err as any)?.errorText ?? ""), // từ Network.loadingFailed
            String(err ?? ""),
            String((err as any)?.name ?? ""),
            String((err as any)?.code ?? ""),
        ].join(" ");

        return TIMEOUT_PATTERNS.some((re) => re.test(msg));
    }

    private isCheckDelayForPairsMs() {
        if (!this.settingUser.delayForPairsMs) {
            return false;
        } else {
            const result = Date.now() < this.nextOpenAt;
            return result;
        }
    }
    private cooldownLeft() {
        return Math.max(0, this.nextOpenAt - Date.now());
    }
    private postponePair(delayForPairsMs: number) {
        if (delayForPairsMs) {
            this.nextOpenAt = Date.now() + delayForPairsMs;
        }
    }

    private isHandleSL() {
        const raw = this.settingUser?.stopLoss;
        const sl = Number(raw);

        // 1) Không có position -> không cần check SL
        if (this.positions.size === 0) {
            // this.logWorker.info("🟣 SL: skip — no positions");
            console.log("🟣 SL: skip — no positions");
            return false;
        }

        // 2) 100 hoặc hơn = tắt SL
        if (sl >= 100) {
            // this.logWorker.info(`🟣 SL: skip — stopLoss = ${this.settingUser.stopLoss}`);
            console.log(`🟣 SL: skip — stopLoss = ${this.settingUser.stopLoss}`);
            return false;
        }

        return true;
    }

    private handleAccountWebGate(accounts: TAccount[]) {
        this.accounts = accounts;
        this.parentPort?.postMessage({ type: "bot:saveAccount", payload: this.accounts });
    }

    private isCheckLimit(): boolean {
        const countsByWindow = this.rateCounter.counts(); // { "1s":..., "1m":..., ...}
        const configuredWindows = Object.keys(this.rateMax) as WindowKey[];

        for (const windowKey of configuredWindows) {
            const configuredMax = this.rateMax[windowKey] ?? 0;
            const currentCount = countsByWindow[windowKey] ?? 0;

            if (configuredMax > 0 && currentCount >= configuredMax) {
                return true;
            }
        }
        return false;
    }

    private handleMaxRate(message: TWorkerData<Record<WindowKey, number>>) {
        const incomingMaxByWindow = message.payload as Record<string, number>;

        // Sanitize từng window và ghép vào cấu hình hiện tại
        const updatedMaxByWindow: Record<WindowKey, number> = { ...this.rateMax };

        (Object.keys(updatedMaxByWindow) as WindowKey[]).forEach((windowKey) => {
            const rawValue = incomingMaxByWindow[windowKey];
            const normalizedMax = Math.max(0, Number(rawValue ?? 0));
            updatedMaxByWindow[windowKey] = Number.isFinite(normalizedMax) ? normalizedMax : 0;
        });

        this.rateMax = updatedMaxByWindow;
    }

    private async getSideCCC(): Promise<getSideRes["side"] | null> {
        try {
            const { data } = await axios.get<getSideRes>(ENDPOINT.CCC.GET_SIDE);
            console.log("getSideCCC: ", data);
            return data.side;
        } catch (error) {
            this.logWorker.error(`getSideCCC: ${error}`);
            return null;
        }
    }

    private async getOrderLiquidation() {
        const url = `https://www.gate.com/apiw/v2/futures/usdt/orders/aggregate?status=finished&hide_cancel=0&contract=&limit=10&order_type=limit&offset=0&start_time=1758128400&end_time=1758733199&sort=finish_time&position_side=&position_type=close`;

        const { body, error, ok } = await this.gateFetch<TGateApiRes<THistoryAggregate[] | null>>(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        if (ok === false || error || body === null) {
            const msg = `❌ Change Leverage: ${error}`;
            throw new Error(msg);
        }

        const { code, data, message } = body;

        console.log("getLiquidation: ", data);
    }

    // Đầu ngày UTC (00:00:00) → giây
    private startOfTodayUtcSec(): number {
        const now = new Date();
        const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()); // 00:00:00 UTC
        return Math.floor(startMs / 1000);
    }

    // Thời điểm hiện tại → giây
    private nowSec(): number {
        return Math.floor(Date.now() / 1000);
    }

    /** Lấy số thứ tự request cho 1 kênh nhất định */
    private nextRequestId(sequenceKey: string): number {
        const current = this.rpcSequenceByKey.get(sequenceKey) ?? 0;
        const next = current + 1;
        this.rpcSequenceByKey.set(sequenceKey, next);
        return next;
    }

    /**
     * Helper RPC tái sử dụng:
     * - Lắng nghe kênh phản hồi `responseType`
     * - Khớp `requestId` qua field id do bạn quy định (vd: "reqClickTabOpenOrderId")
     * - Áp timeout
     * - Trả { ok, body, error, requestId }
     */
    private async sendIpcRpc<TBody>({
        sequenceKey,
        requestType,
        responseType,
        idFieldName,
        buildPayload,
        timeoutMs = 10_000,
    }: {
        sequenceKey: string;
        requestType: string;
        responseType: string;
        idFieldName: string;
        buildPayload: (requestId: number) => any;
        timeoutMs?: number;
    }): Promise<{ ok: boolean; body: TBody | null; error: string | null; requestId: number }> {
        const requestId = this.nextRequestId(sequenceKey);
        const port = this.parentPort!;

        return new Promise((resolve) => {
            let isSettled = false;
            let timeoutHandle: NodeJS.Timeout;

            const finish = (result: { ok: boolean; body: TBody | null; error: string | null; requestId: number }) => {
                if (isSettled) return;
                isSettled = true;
                clearTimeout(timeoutHandle);
                try {
                    port.off("message", onMessage);
                } catch {}
                resolve(result);
            };

            const onMessage = (message: any) => {
                try {
                    if (message?.type !== responseType) return;
                    if (message?.payload?.[idFieldName] !== requestId) return;

                    const payload = message.payload as { ok: boolean; body: TBody | null; error?: string | null };
                    console.log(responseType, payload);
                    if (!payload.ok) {
                        return finish({ ok: false, body: null, error: payload.error || "RPC failed", requestId });
                    }
                    return finish({ ok: true, body: (payload.body ?? null) as TBody | null, error: null, requestId });
                } catch (error) {
                    return finish({ ok: false, body: null, error: `RPC handler error: ${String(error)}`, requestId });
                }
            };

            // 1) nghe trước
            port.on("message", onMessage);

            // 2) timeout
            timeoutHandle = setTimeout(() => {
                finish({ ok: false, body: null, error: `${requestType} rpc timeout`, requestId });
            }, timeoutMs);

            // 3) gửi sau
            const payload = buildPayload(requestId);
            port.postMessage({ type: requestType, payload });
        });
    }

    private toUnixSeconds(numeric: number): number {
        // 1e12: ngưỡng an toàn phân biệt ms vs s cho thời điểm hiện tại
        if (numeric > 1e12) return Math.floor(numeric / 1000);
        return Math.floor(numeric);
    }

    private async getHistoryOrderClose(start_time: number, end_time: number, contract: string = "") {
        // const url = `https://www.gate.com/apiw/v2/futures/usdt/orders/aggregate?status=finished&hide_cancel=0&contract=&limit=10&order_type=limit&offset=0&start_time=${start_time}&end_time=${end_time}&sort=finish_time&position_side=&position_type=close`;
        const qs = new URLSearchParams({
            status: "finished",
            hide_cancel: "0",
            contract: contract,
            limit: "1000",
            order_type: "limit",
            offset: "0",
            start_time: String(this.toUnixSeconds(start_time)),
            end_time: String(this.toUnixSeconds(end_time)),
            sort: "",
            position_side: "",
            position_type: "close",
        });

        const url = `https://www.gate.com/apiw/v2/futures/usdt/orders/aggregate?${qs}`;

        const { body, error, ok } = await this.gateFetch<TGateApiRes<THistoryAggregate[] | null>>(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        if (ok === false || error || body === null) {
            const msg = `❌ Change Leverage: ${error}`;
            throw new Error(msg);
        }

        const { code, data, message } = body;

        return data;
    }

    private async createLiquidationShouldFix() {
        if (this.settingUser.stopLoss < 100) {
            console.log(`🧨 Create Order Fix Liquidation: Skip by stoploss < 100`);
            return;
        }

        if (this.dataFixLiquidation.dataLiquidationShouldFix) {
            console.log("🧨 Create Liquidation Should Fix: Skip by dataLiquidationShouldFix exists");
            return;
        }

        const historysOrderClose = await this.getHistoryOrderClose(this.dataFixLiquidation.startTimeSec || this.startOfTodayUtcSec(), this.nowSec());

        if (!historysOrderClose) {
            this.logWorker.error(`❌ historyOrderClose is null`);
            return;
        }

        // lọc các lệnh liq từ history
        const listLiq = historysOrderClose.filter((item: THistoryAggregate) => {
            return item.is_liq;
        });

        const liq = listLiq.at(this.dataFixLiquidation.startTimeSec === null ? 0 : -1);

        if (!liq) return;

        // console.log("liq: ", liq);

        this.dataFixLiquidation.dataLiquidationShouldFix = {
            contract: liq.contract,
            create_time: liq.create_time,
        };

        this.dataFixLiquidation.startTimeSec = this.toUnixSeconds(liq.finish_time);

        this.upsertFixLiquidation();
    }

    private async createOrderOpenFixLiquidation(symbol: string, price: string, lastPriceGate: number, quanto_multiplier: number): Promise<boolean> {
        if (this.settingUser.stopLoss < 100) {
            console.log(`🧨 Create Order Fix Liquidation: Skip by stoploss < 100`);
            return false;
        }

        if (this.dataFixLiquidation.dataLiquidationShouldFix === null) {
            // this.logWorker.info(`🧨 Create Order Fix Liquidation: Skip by không có để fix`);
            console.log(`🧨 Create Order Fix Liquidation: Skip by không có để fix`);
            return false;
        }

        if (this.dataFixLiquidation.dataOrderOpenFixLiquidation) {
            // this.logWorker.info(`🧨 Create Order Fix Liquidation: Skip by đã có lệnh chờ để fix, không vào nữa`);
            console.log(`🧨 Create Order Fix Liquidation: Skip by đã có lệnh chờ để fix, không vào nữa`);
            return false;
        }

        const contract = symbol.replace("/", "_");

        const inputUSDT = this.settingUser.martingale?.options?.[this.dataFixLiquidation.stepFixLiquidation]?.inputUSDT || this.settingUser.inputUSDT;
        const leverage = this.settingUser.martingale?.options?.[this.dataFixLiquidation.stepFixLiquidation]?.leverage || this.settingUser.leverage;

        this.dataFixLiquidation.inputUSDTFix = inputUSDT;
        this.dataFixLiquidation.leverageFix = leverage;
        this.upsertFixLiquidation();

        const sizeStr = calcSize(inputUSDT, lastPriceGate, quanto_multiplier).toString();

        const payload = {
            contract: contract,
            size: sizeStr,
            price: price,
            reduce_only: false,
        };

        try {
            const ok = await this.changeLeverage(contract, leverage);
            if (!ok) return false;
            const res = await this.openEntry(payload, `🧨 Martingale Liquidation step ${this.dataFixLiquidation.stepFixLiquidation}`);

            this.dataFixLiquidation.dataOrderOpenFixLiquidation = {
                contract: res.contract,
                price: res.price,
                fill_price: res.fill_price,
                create_time: res.create_time,
            };

            this.upsertFixLiquidation();

            return true;
        } catch (error: any) {
            if (error?.message === INSUFFICIENT_AVAILABLE) {
                throw new Error(error);
            }
            if (this.isTimeoutError(error)) {
                throw new Error(error);
            }
            this.logWorker.error(error?.message);
            return false;
        }
    }

    private async checkDataFixLiquidationIsDone() {
        if (this.settingUser.stopLoss < 100) {
            // console.log(`🧨 Check Liquidation Is Done: Skip by stoploss < 100`);
            return;
        }

        if (this.dataFixLiquidation.dataLiquidationShouldFix === null) {
            // this.logWorker.info(`Skip by listLiquidationShouldFix is null`);
            return;
        }

        if (this.dataFixLiquidation.startTimeSec === null) {
            // this.logWorker.info(`Skip by startTimeSec is null`);
            return;
        }

        if (this.dataFixLiquidation.dataCloseTP === null) {
            // this.logWorker.info(`Skip by chưa có lệnh chờ tp của OrderOpenFixLiquidation`);
            // console.log(`🧨 Check Liquidation Is Done: Skip by chưa có lệnh chờ tp của OrderOpenFixLiquidation`);
            return;
        }

        const contractCloseTP = this.dataFixLiquidation.dataCloseTP.contract.replace("/", "_");
        const contractShouldFix = this.dataFixLiquidation.dataLiquidationShouldFix.contract.replace("/", "_");

        const historysOrderClose = await this.getHistoryOrderClose(this.dataFixLiquidation.startTimeSec, this.nowSec(), contractCloseTP);

        if (!historysOrderClose) {
            this.logWorker.info(`🧨 historyOrderClose is null`);
            return;
        }

        const hisCloseTPSuccess = historysOrderClose.find((historyOrderClose) => {
            const isFind = historyOrderClose.is_liq === false;
            if (isFind) {
                // this.logWorker.info(`🔵 ${contractShouldFix} Tìm thấy lệnh Tp (filled): fix thành công`);
            }
            return isFind;
        });

        const hisPositionFixLiquidation = historysOrderClose.find((historyOrderClose) => {
            const isFind = historyOrderClose.is_liq === true;
            if (isFind) {
                // this.logWorker.info(`❌ ${contractShouldFix} Tìm thấy lệnh thanh lý (liquidated): fix thất bại`);
            }
            return isFind;
        });

        if (hisCloseTPSuccess === undefined && hisPositionFixLiquidation === undefined) {
            // this.logWorker.info(`🔵 ${contractShouldFix} skip by đang đợi lệnh fix để lệnh fix bị thanh lý hoặc lệnh tp khớp`);
            console.log(`🔵 ${contractShouldFix} skip by đang đợi lệnh fix để lệnh fix bị thanh lý hoặc lệnh tp khớp`);
            return;
        }
        if (hisPositionFixLiquidation) {
            let stepNext = this.dataFixLiquidation.stepFixLiquidation + 1;
            const maxStep = (this.settingUser.martingale?.options?.length ?? 0) - 1;
            if (stepNext > maxStep) {
                stepNext = 0;
                this.logWorker.info(
                    `🧨 ❌ ${contractShouldFix} Fix thất bại reset step: ${this.dataFixLiquidation.stepFixLiquidation} -> ${stepNext} / ${maxStep}`,
                );
            } else {
                this.logWorker.info(
                    `🧨 ❌ ${contractShouldFix} Fix thất bại tăng step: ${this.dataFixLiquidation.stepFixLiquidation} -> ${stepNext} / ${maxStep}`,
                );
            }
            this.upsertFixLiquidation(true, EStatusFixLiquidation.FAILED);

            this.dataFixLiquidation.dataLiquidationShouldFix = null;
            this.dataFixLiquidation.dataOrderOpenFixLiquidation = null;
            this.dataFixLiquidation.dataCloseTP = null;

            this.dataFixLiquidation.stepFixLiquidation = stepNext;
            this.dataFixLiquidation.startTimeSec = this.toUnixSeconds(this.dataFixLiquidation.startTimeSec + 1);
            this.upsertFixLiquidation();
            return;
        }
        if (hisCloseTPSuccess) {
            this.logWorker.info(`🧨 ✅ ${contractShouldFix} Fix thành công`);
            this.upsertFixLiquidation(true, EStatusFixLiquidation.SUCCESS);

            this.dataFixLiquidation.dataLiquidationShouldFix = null;
            this.dataFixLiquidation.dataOrderOpenFixLiquidation = null;
            this.dataFixLiquidation.dataCloseTP = null;

            this.dataFixLiquidation.stepFixLiquidation = 0;
            this.dataFixLiquidation.startTimeSec = this.toUnixSeconds(this.dataFixLiquidation.startTimeSec + 1);
            this.upsertFixLiquidation();
            return;
        }
    }

    private syncDataOrderOpenFixLiquidation(orderOpens: TOrderOpen[]) {
        if (!orderOpens) return;
        if (this.orderOpens.length === 0) {
            this.dataFixLiquidation.dataOrderOpenFixLiquidation = null;
            this.upsertFixLiquidation();
            return;
        }
        if (!this.dataFixLiquidation?.dataOrderOpenFixLiquidation) return;

        const contractOrderOpenFixLiquidation = this.dataFixLiquidation.dataOrderOpenFixLiquidation.contract.replace("/", "_");

        const isExits = orderOpens.some((orderOpen) => {
            return contractOrderOpenFixLiquidation === orderOpen.contract.replace("/", "_");
        });

        // nếu không tồn tại trong tab orderOpen thì clear
        if (!isExits) {
            this.dataFixLiquidation.dataOrderOpenFixLiquidation = null;
            this.upsertFixLiquidation();
        }
    }
    private syncDataOrderOpenFixStopLoss() {
        if (this.orderOpens.length === 0) {
            this.dataFixStopLoss.dataOrderOpenFixStopLoss = null;
            this.upsertFixStopLoss();
            return;
        }
        if (!this.dataFixStopLoss?.dataOrderOpenFixStopLoss) return;

        const contractOrderOpenFixStopLoss = this.dataFixStopLoss.dataOrderOpenFixStopLoss.contract.replace("/", "_");

        const isExits = this.orderOpens.some((orderOpen) => {
            return contractOrderOpenFixStopLoss === orderOpen.contract.replace("/", "_");
        });

        // nếu không tồn tại trong tab orderOpen thì clear
        if (!isExits) {
            this.dataFixStopLoss.dataOrderOpenFixStopLoss = null;
            this.upsertFixStopLoss();
        }
    }

    private setTakeProfitAccount(msg: TWorkerData<TTakeprofitAccount | null>) {
        this.takeProfitAccount = msg.payload;
    }

    private isNextPhase(): boolean {
        // this.logWorker.info(`roi ${this.takeProfitAccount?.roi}%/${this.settingUser.maxRoiNextPhase}%`);
        if (!this.takeProfitAccount) return false;
        if (this.settingUser.maxRoiNextPhase === 0) return false;
        if (this.takeProfitAccount.roi >= this.settingUser.maxRoiNextPhase) {
            this.logWorker.info(`➡️ Next phase: ${this.takeProfitAccount.roi} >= ${this.settingUser.maxRoiNextPhase}`);
            return true;
        }
        return false;
    }

    private async handleNextPhase() {
        this.stop();

        await this.clickClearAll();

        // chốt trước khi chuyển phase
        this.upsertFixLiquidation(false, EStatusFixLiquidation.FAILED);
        this.logWorker.info("➡️ Next phase 🧨 Reset All Fix Liquidation");
        this.dataFixLiquidation.dataLiquidationShouldFix = null;
        this.dataFixLiquidation.dataOrderOpenFixLiquidation = null;
        this.dataFixLiquidation.dataCloseTP = null;
        this.dataFixLiquidation.startTimeSec = null;
        this.dataFixLiquidation.stepFixLiquidation = 0;
        this.dataFixLiquidation.inputUSDTFix = null;
        this.dataFixLiquidation.leverageFix = null;

        // chốt trước khi chuyển phase
        this.logWorker.info("➡️ Next phase 🤷 Reset All Fix StopLoss");
        this.fixStopLossQueue = [];
        this.sendFixStopLossQueue();
        this.fixStopLossFailedPassTrue(0);

        if (this.takeProfitAccount) {
            this.takeProfitAccount.roi = 0;
        }

        this.start();
    }

    private upsertFixLiquidation(isDone: boolean = false, status: EStatusFixLiquidation = EStatusFixLiquidation.PROCESSING) {
        if (!this.dataFixLiquidation.startTimeSec) return;

        const payload: TUpsertFixLiquidationReq = {
            scopeExchangeId: 1,
            data: this.dataFixLiquidation,
            startTimeSec: this.dataFixLiquidation.startTimeSec,
            isDone: isDone,
            status: status,
        };

        this.parentPort?.postMessage({ type: "bot:upsertFixLiquidation", payload: payload });
    }

    private upsertFixStopLoss(isDone: boolean = false, status: EStatusFixStopLoss = EStatusFixStopLoss.PROCESSING) {
        if (!this.dataFixStopLoss.startTimeSec) return;

        if (!this.dataFixStopLoss.dataStopLossShouldFix) return;

        const payload: TUpsertFixStopLossReq = {
            scopeExchangeId: 1,
            data: this.dataFixStopLoss,
            startTimeSec: this.dataFixStopLoss.startTimeSec,
            isDone: isDone,
            status: status,
        };

        this.parentPort?.postMessage({ type: "bot:upsertFixStopLoss", payload: payload });
    }

    private createStopLossShouldFix() {
        if (this.settingUser.stopLoss >= 100) {
            console.log(`🤷 Create Order Fix StopLoss: Skip by stoploss >= 100`);
            return;
        }

        if (this.dataFixStopLoss.dataStopLossShouldFix) {
            console.log("🤷 Create StopLoss Should Fix: Skip by dataStopLossShouldFix exists");
            return;
        }

        if (this.fixStopLossQueue.length === 0) {
            // this.logWorker.info("🤷 Create StopLoss Should Fix: Skip by fixStopLossQueue empty");
            console.log("🤷 Create StopLoss Should Fix: Skip by fixStopLossQueue empty");
            return;
        }

        const itemDataStopLossShouldFix = this.fixStopLossQueue.shift();
        this.sendFixStopLossQueue();
        // this.logWorker.info(`🤷 itemDataStopLossShouldFix`, itemDataStopLossShouldFix?.contract);

        if (!itemDataStopLossShouldFix) {
            console.log("🤷 Create StopLoss Should Fix: Skip by fixStopLossQueue empty");
            return;
        }

        this.dataFixStopLoss.dataStopLossShouldFix = {
            contract: itemDataStopLossShouldFix.contract,
            open_time: itemDataStopLossShouldFix.open_time,
        };
        this.dataFixStopLoss.startTimeSec = this.toUnixSeconds(itemDataStopLossShouldFix.open_time);

        this.upsertFixStopLoss();
    }

    private async createOrderOpenFixStopLoss(
        symbol: string,
        price: string,
        lastPriceGate: number,
        quanto_multiplier: number,
        side: string,
    ): Promise<boolean> {
        if (this.settingUser.stopLoss >= 100) {
            console.log(`🤷 Create Order Fix StopLoss: Skip by stoploss >= 100`);
            return false;
        }

        if (this.dataFixStopLoss.dataStopLossShouldFix === null) {
            // this.logWorker.info(`🤷 Create Order Fix StopLoss: Skip by không có để fix`);
            console.log(`🤷 Create Order Fix StopLoss: Skip by không có để fix`);
            return false;
        }

        if (this.dataFixStopLoss.dataOrderOpenFixStopLoss) {
            // this.logWorker.info(`🤷 Create Order Fix Liquidation: Skip by đã có lệnh chờ để fix, không vào nữa`);
            console.log(`🤷 Create Order Fix StopLoss: Skip by đã có lệnh chờ để fix, không vào nữa`);
            return false;
        }

        if (!this.whiteListMartingale.includes(symbol.replace("/", "_"))) {
            // console.log(`🤷 Create Order Fix StopLoss: Skip by ${symbol} exist whiteListMartingale`);
            this.logWorker.info(`🤷 Create Order Fix StopLoss: Skip by ${symbol} not exist whiteListMartingale`);
            return false;
        }

        const contract = symbol.replace("/", "_");

        const step = this.dataFixStopLoss.stepFixStopLoss;
        const inputUSDT = this.settingUser.martingale?.options?.[step]?.inputUSDT || this.settingUser.inputUSDT;
        const leverage = this.settingUser.martingale?.options?.[step]?.leverage || this.settingUser.leverage;

        console.log("🤷 stepFixStopLoss", step);

        this.dataFixStopLoss.inputUSDTFix = inputUSDT;
        this.dataFixStopLoss.leverageFix = leverage;
        this.upsertFixStopLoss();

        const sizeStr = calcSize(inputUSDT, lastPriceGate, quanto_multiplier).toString();

        const payload: TPayloadOrder = {
            contract: contract,
            size: side === "long" ? sizeStr : `-${sizeStr}`,
            price: price,
            reduce_only: false,
        };

        try {
            const ok = await this.changeLeverage(contract, leverage);
            if (!ok) return false;
            const res = await this.openEntry(payload, `🤷 Martingale StopLoss step ${step}`);

            this.dataFixStopLoss.dataOrderOpenFixStopLoss = {
                contract: res.contract,
                create_time: res.create_time,
                fill_price: res.fill_price,
                price: res.price,
            };

            this.upsertFixStopLoss();

            return true;
        } catch (error: any) {
            if (error?.message === INSUFFICIENT_AVAILABLE) {
                throw new Error(error);
            }
            if (this.isTimeoutError(error)) {
                throw new Error(error);
            }
            this.logWorker.error(error?.message);
            return false;
        }
    }

    private async checkDataFixStopLossIsDone() {
        if (this.settingUser.stopLoss >= 100) {
            // console.log(`🧨 Check Liquidation Is Done: Skip by stoploss < 100`);
            return;
        }

        if (this.dataFixStopLoss.dataStopLossShouldFix === null) {
            // this.logWorker.info(`Skip by listLiquidationShouldFix is null`);
            return;
        }

        if (this.dataFixStopLoss.startTimeSec === null) {
            // this.logWorker.info(`Skip by startTimeSec is null`);
            return;
        }

        if (this.dataFixStopLoss.dataCloseTP === null) {
            // this.logWorker.info(`Skip by chưa có lệnh chờ tp của OrderOpenFixLiquidation`);
            console.log(`🤷 Check Fix StopLoss Is Done: Skip by chưa có lệnh chờ tp của OrderOpenFixStopLoss`);
            return;
        }

        const contractCloseTP = this.dataFixStopLoss.dataCloseTP.contract.replace("/", "_");
        const contractShouldFix = this.dataFixStopLoss.dataStopLossShouldFix.contract.replace("/", "_");
        const idStringCloseTP = this.dataFixStopLoss.dataCloseTP.id_string;

        const historysOrderClose = await this.getHistoryOrderClose(this.dataFixStopLoss.startTimeSec, this.nowSec(), contractCloseTP);

        if (!historysOrderClose) {
            this.logWorker.info(`🤷 historyOrderClose StopLoss is null`);
            return;
        }

        const hisCloseTPSuccess = historysOrderClose.find((historyOrderClose) => {
            const isFind = historyOrderClose.id_string === idStringCloseTP && historyOrderClose.left === 0;
            if (isFind) {
                // this.logWorker.info(`🤷 ✅${contractShouldFix} Tìm thấy lệnh Tp (filled): fix thành công`);
            }
            return isFind;
        });

        const hisCloseTPFail = historysOrderClose.find((historyOrderClose) => {
            const isFind = historyOrderClose.id_string === idStringCloseTP && historyOrderClose.left !== 0;
            if (isFind) {
                // this.logWorker.info(`🤷 ❌ ${contractShouldFix} Tìm thấy lệnh thanh lý (liquidated): fix thất bại`);
            }
            return isFind;
        });

        if (hisCloseTPSuccess === undefined && hisCloseTPFail === undefined) {
            // this.logWorker.info(`🔵 ${contractShouldFix} skip by đang đợi lệnh fix để lệnh fix bị thanh lý hoặc lệnh tp khớp`);
            console.log(`🤷 ${contractShouldFix} skip by đang đợi lệnh fix để lệnh fix bị thanh lý hoặc lệnh tp khớp`);
            return;
        }
        if (hisCloseTPFail) {
            let stepNext = this.dataFixStopLoss.stepFixStopLoss + 1;
            const maxStep = (this.settingUser.martingale?.options?.length ?? 0) - 1;
            if (stepNext > maxStep) {
                stepNext = 0;
                this.logWorker.info(
                    `🤷 ❌ ${contractShouldFix} Fix thất bại reset step: ${this.dataFixStopLoss.stepFixStopLoss} -> ${stepNext} / ${maxStep}`,
                );
                this.fixStopLossFailedPassTrue(stepNext);
                return;
            } else {
                this.logWorker.info(
                    `🤷 ❌ ${contractShouldFix} Fix thất bại tăng step: ${this.dataFixStopLoss.stepFixStopLoss} -> ${stepNext} / ${maxStep}`,
                );
                this.fixStopLossFailedPassFalse(stepNext);
                return;
            }
        }
        if (hisCloseTPSuccess) {
            this.logWorker.info(`🤷 ✅ ${contractShouldFix} Fix thành công`);
            this.fixStopLossSuccess();
            return;
        }
    }

    private fixStopLossSuccess() {
        this.sendFixStopLossHistories();

        this.dataFixStopLoss.dataOrderOpenFixStopLoss = null;
        this.dataFixStopLoss.dataCloseTP = null;
        this.dataFixStopLoss.stepFixStopLoss = 0;
        this.dataFixStopLoss.inputUSDTFix = null;
        this.dataFixStopLoss.leverageFix = null;
        this.upsertFixStopLoss(true, EStatusFixStopLoss.SUCCESS);

        this.dataFixStopLoss.dataStopLossShouldFix = null;
        this.dataFixStopLoss.startTimeSec = null;
    }

    private fixStopLossFailedPassFalse(stepNext: number) {
        this.sendFixStopLossHistories();

        this.dataFixStopLoss.dataOrderOpenFixStopLoss = null;
        this.dataFixStopLoss.dataCloseTP = null;
        this.dataFixStopLoss.stepFixStopLoss = stepNext;
        this.dataFixStopLoss.inputUSDTFix = null;
        this.dataFixStopLoss.leverageFix = null;
        this.upsertFixStopLoss();
    }

    private fixStopLossFailedPassTrue(stepNext: number) {
        this.sendFixStopLossHistories();

        this.dataFixStopLoss.dataOrderOpenFixStopLoss = null;
        this.dataFixStopLoss.dataCloseTP = null;
        this.dataFixStopLoss.stepFixStopLoss = stepNext;
        this.dataFixStopLoss.inputUSDTFix = null;
        this.dataFixStopLoss.leverageFix = null;
        this.upsertFixStopLoss(true, EStatusFixStopLoss.FAILED);

        this.dataFixStopLoss.dataStopLossShouldFix = null;
        this.dataFixStopLoss.startTimeSec = null;
    }

    private getLeverageLiquidationForFix(contract: string): number | undefined {
        let isPositionFix = false;

        if (this.dataFixLiquidation && this.dataFixLiquidation.dataOrderOpenFixLiquidation) {
            const contractPosition = contract.replace("/", "_");
            const contractOrderOpenFixLiquidation = this.dataFixLiquidation.dataOrderOpenFixLiquidation.contract.replace("/", "_");
            if (contractPosition === contractOrderOpenFixLiquidation) {
                isPositionFix = true;
            }
        }

        if (!isPositionFix) return;

        const leverageFixLiquidation = this.settingUser.martingale?.options[this.dataFixLiquidation.stepFixLiquidation].leverage;

        if (!leverageFixLiquidation) return;

        return leverageFixLiquidation;
    }

    private getLeverageStopLossForFix(contract: string): number | undefined {
        let isPositionFix = false;

        if (this.dataFixStopLoss && this.dataFixStopLoss.dataOrderOpenFixStopLoss) {
            const contractPosition = contract.replace("/", "_");
            const contractOrderOpenFixStopLoss = this.dataFixStopLoss.dataOrderOpenFixStopLoss.contract.replace("/", "_");
            if (contractPosition === contractOrderOpenFixStopLoss) {
                isPositionFix = true;
            }
        }

        if (!isPositionFix) return;

        const leverageFixStopLoss = this.settingUser.martingale?.options[this.dataFixStopLoss.stepFixStopLoss].leverage;

        if (!leverageFixStopLoss) return;

        return leverageFixStopLoss;
    }

    private handlePushFixStopLossQueue(position: TPosition) {
        let isPush = true;

        if (this.dataFixStopLoss.dataOrderOpenFixStopLoss) {
            const contractPosition = position.contract.replace("/", "_");
            const contractOrderOpenFixStopLoss = this.dataFixStopLoss.dataOrderOpenFixStopLoss.contract.replace("/", "_");

            if (contractPosition === contractOrderOpenFixStopLoss) {
                isPush = false;
            }
        }

        const isExits = this.fixStopLossQueue.some((item) => {
            const time1 = this.toUnixSeconds(position.open_time);
            const time2 = this.toUnixSeconds(item.open_time);
            return time1 === time2;
        });

        if (isExits) {
            isPush = false;
        }

        if (isPush) {
            this.fixStopLossQueue.push({
                contract: position.contract,
                open_time: this.toUnixSeconds(position.open_time),
            });

            this.sendFixStopLossQueue();
        }
    }

    private isFixStopLoss() {
        if (this.settingUser.stopLoss < 100) {
            return true;
        }
        return false;
    }

    private sendFixStopLossQueue() {
        this.parentPort?.postMessage({
            type: "bot:upsertFixStopLossQueue",
            payload: this.fixStopLossQueue,
        });
    }

    private sendFixStopLossHistories() {
        if (!this.dataFixStopLoss.startTimeSec) return;

        const payload: TDataFixStopLossHistoriesReq = {
            data: {
                dataOrderOpenFixStopLoss: this.dataFixStopLoss.dataOrderOpenFixStopLoss,
                dataCloseTP: this.dataFixStopLoss.dataCloseTP,
                stepFixStopLoss: this.dataFixStopLoss.stepFixStopLoss,
                inputUSDTFix: this.dataFixStopLoss.inputUSDTFix,
                leverageFix: this.dataFixStopLoss.leverageFix,
            },
            startTimeSec: this.dataFixStopLoss.startTimeSec,
        };

        this.parentPort?.postMessage({
            type: "bot:createFixStopLossHistories",
            payload: payload,
        });
    }

    private removeFixStopLossQueue(msg: TWorkerData<TDataStopLossShouldFix>) {
        const { payload } = msg;
        this.fixStopLossQueue = this.fixStopLossQueue.filter((item) => {
            return item.open_time !== payload.open_time;
        });
        this.sendFixStopLossQueue();
    }

    private async checkLoginGate() {
        const selectorCheckLogin = this.uiSelector?.find((item) => item.code === "checkLogin")?.selectorValue;

        if (!selectorCheckLogin) {
            this.logWorker.info(`❌ Not found selector checkLogin`);
            throw new Error(`Not found selector checkLogin`);
        }

        const stringCheckLogin = createCodeStringCheckLogin({ checkLogin: selectorCheckLogin });

        const { body, error, ok } = await this.sendIpcRpc<boolean>({
            sequenceKey: "checkLogin",
            requestType: "bot:checkLogin",
            responseType: "bot:checkLogin:res",
            idFieldName: "reqCheckLoginId",
            buildPayload: (requestId) => ({
                reqCheckLoginId: requestId,
                stringCheckLogin,
            }),
            timeoutMs: 10_000,
        });

        if (!ok || error || body == null) {
            throw new Error(`❌ Check Login error: ${error ?? "unknown"} ${body} ${ok}`);
        }

        this.logWorker.info(`✅ Check Login`);

        return body;
    }

    private async getUid() {
        const selectorGetUid = this.uiSelector?.find((item) => item.code === "getUid")?.selectorValue;

        if (!selectorGetUid) {
            this.logWorker.info(`❌ Not found selector getUid`);
            throw new Error(`Not found selector getUid`);
        }

        const stringGetUid = createCodeStringGetUid({ getUid: selectorGetUid });

        const { body, error, ok } = await this.sendIpcRpc<string | null>({
            sequenceKey: "getUid",
            requestType: "bot:getUid",
            responseType: "bot:getUid:res",
            idFieldName: "reqGetUidId",
            buildPayload: (requestId) => ({
                reqGetUidId: requestId,
                stringGetUid,
            }),
            timeoutMs: 10_000,
        });

        if (!ok || error) {
            throw new Error(`❌ Get Uid error: ${error ?? "unknown"} ${body} ${ok}`);
        }

        if (body == null) {
            if (this.uidWeb || this.uidWeb === undefined) {
                this.logWorker.info("❌ Not logined to gate");
            }
            this.uidWeb = null;
        } else {
            if (!this.uidWeb) {
                this.logWorker.info("✅ Logined to gate");
            }
            this.uidWeb = Number(body);
        }
    }

    private checkUid() {
        if (this.uidWeb) {
            if (this.uidWeb !== this.uidDB) {
                throw new Error(`❌ Please login uid: ${this.uidDB}`);
            }
        }
    }
}

export type WindowKey = "1s" | "1m" | "5m" | "15m" | "30m" | "1h";

const WINDOW_MS: Record<WindowKey, number> = {
    "1s": 1_000,
    "1m": 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
};

class SlidingRateCounter {
    private queues: Record<WindowKey, number[]> = {
        "1s": [],
        "1m": [],
        "5m": [],
        "15m": [],
        "30m": [],
        "1h": [],
    };
    private stopped = false;

    /** Bắt đầu một lần đếm (đếm ngay lập tức). Trả token để có thể rollback. */
    startAttempt(): { token: number } {
        if (this.stopped) return { token: -1 };
        const now = Date.now();
        (Object.keys(this.queues) as WindowKey[]).forEach((k) => {
            const q = this.queues[k];
            q.push(now);
            this.prune(k, now);
        });
        return { token: now };
    }

    /** Nếu gặp TOO_MANY_REQUEST thì rollback lần đếm vừa add. */
    rollback(h: { token: number }) {
        if (this.stopped || h.token < 0) return;
        (Object.keys(this.queues) as WindowKey[]).forEach((k) => {
            const q = this.queues[k];
            const i = q.lastIndexOf(h.token);
            if (i !== -1) q.splice(i, 1);
        });
    }

    /** Với các trường hợp khác (thành công / lỗi khác 429) thì giữ nguyên. */
    commit(_h: { token: number }) {
        // no-op vì đã add ở startAttempt()
    }

    /** Ngừng đếm từ bây giờ. */
    stop() {
        this.stopped = true;
    }
    isStopped() {
        return this.stopped;
    }

    /** Lấy số liệu hiện tại (tự prune trước khi trả). */
    counts(): Record<WindowKey, number> {
        const now = Date.now();
        (Object.keys(this.queues) as WindowKey[]).forEach((k) => this.prune(k, now));
        return {
            "1s": this.queues["1s"].length,
            "1m": this.queues["1m"].length,
            "5m": this.queues["5m"].length,
            "15m": this.queues["15m"].length,
            "30m": this.queues["30m"].length,
            "1h": this.queues["1h"].length,
        };
    }

    private prune(k: WindowKey, now: number) {
        const q = this.queues[k];
        const edge = now - WINDOW_MS[k];
        // loại bỏ mọi timestamp <= edge
        while (q.length && q[0] <= edge) q.shift();
    }
}
