// bot.worker.ts
import { BASE_URL, IS_PRODUCTION } from "@/constant/app.constant";
import { ENDPOINT } from "@/constant/endpoint.constant";
import { createCodeStringCheckLogin, createCodeStringClickMarketPosition, createCodeStringGetUid } from "@/javascript-string/logic-farm";
import { TAccount } from "@/types/account.type";
import { TRes } from "@/types/app.type";
import { TGateApiRes } from "@/types/base-gate.type";
import { TSide } from "@/types/base.type";
import { TBidsAsks } from "@/types/bids-asks.type";
import {
    TChangeLeverage,
    TDataInitBot,
    TDataOrder,
    TFectWorkRes,
    TGateClickCancelAllOpenRes,
    TGateFectMainRes,
    TGateOrderMainRes,
    TOrderWorkRes,
    TPayloadFollowApi,
    TPayloadOrder,
    TUiSelectorOrder,
    TValueChangeLeverage,
} from "@/types/bot.type";
import { TGetInfoContractRes } from "@/types/contract.type";
import { ELogType } from "@/types/enum/log-type.enum";
import { TOrderOpen } from "@/types/order.type";
import { TPosition } from "@/types/position.type";
import { TSettingUsers } from "@/types/setting-user.type";
import { TSideCountsIOC, TSideCountsIOCitem } from "@/types/side-count-ioc.type";
import { TUiSelector } from "@/types/ui-selector.type";
import { TUid } from "@/types/uid.type";
import { TWhiteListFarmIoc } from "@/types/white-list-farm-ioc.type";
import { TMaxScapsPosition, TWhiteListScalpIoc } from "@/types/white-list-scalp-ioc.type";
import { TWhiteList, TWhiteListItem } from "@/types/white-list.type";
import { TWorkerData, TWorkerHeartbeat, TWorkLog } from "@/types/worker.type";
import axios from "axios";
import { LogFunctions } from "electron-log";
import { performance } from "node:perf_hooks";
import { parentPort } from "node:worker_threads";

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
                    text: `6) ✅ bot:init - received  | PID: ${process.pid}`,
                },
            };
            parentPort?.postMessage(payload);
            if (!bot) {
                const dataInitBot: TDataInitBot = {
                    parentPort: parentPort!,
                    settingUser: msg.payload.settingUser,
                    uiSelector: msg.payload.uiSelector,
                    whiteListFarmIoc: msg.payload.whiteListFarmIoc,
                    whiteListScalpIoc: msg.payload.whiteListScalpIoc,
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

    /**
     * key của map: "BTC_USDT", dữ liệu contract bên trong "BTC/USDT"
     */
    private positions = new Map<string, TPosition>();

    private changedLaveragelist = new Map<string, TValueChangeLeverage>();
    private changedLaverageCrosslist = new Map<string, TValueChangeLeverage>();
    private settingUser: TSettingUsers;
    private uiSelector: TUiSelector[];

    private whiteList: TWhiteList = {};

    private infoContract = new Map<string, TGetInfoContractRes>();
    private whiteListFarmIoc: TWhiteListFarmIoc[] = [];
    private whiteListScalpIoc: TWhiteListScalpIoc[] = [];
    private nextOpenAt = new Map<string, number>();
    private accounts: TAccount[] = [];

    private rpcSequenceByKey = new Map<string, number>();

    private uidDB: TUid["uid"];

    private uidWeb: TUid["uid"] | null | undefined = undefined;

    /**
     * key của map: "BTC_USDT", dữ liệu contract bên trong "BTC/USDT"
     */
    private maxScalpsPosition = new Map<string, TMaxScapsPosition>();

    /**
     * key của map: "BTC_USDT", dữ liệu contract bên trong "BTC/USDT"
     */
    private maxFarmsPosition = new Map<string, TMaxScapsPosition>();

    private sideCountsIOC: TSideCountsIOC = new Map();

    constructor(dataInitBot: TDataInitBot) {
        this.parentPort = dataInitBot.parentPort;
        this.settingUser = dataInitBot.settingUser;
        this.uiSelector = dataInitBot.uiSelector;
        this.whiteListFarmIoc = dataInitBot.whiteListFarmIoc;
        this.whiteListScalpIoc = dataInitBot.whiteListScalpIoc;
        this.uidDB = dataInitBot.uidDB;

        this.run();
    }

    private async run() {
        if (this.running) return;
        this.running = true;
        this.parentPort.postMessage({ type: "bot:init:done", payload: true });
        for (;;) {
            const iterStart = performance.now();
            try {
                this.log(`\n\n\n\n\n ✅✅✅✅✅ ITER START ${this.isStart} | ${this.running} =====`);
                await this.beforeEach();

                // if (!this.uidWeb) continue;

                if (this.isStart) {
                    const isOneWay = await this.handleDualMode("oneway");
                    if (!isOneWay) continue;

                    for (const [key, entry] of Object.entries(this.whiteList)) {
                        const symbol = entry.core.gate.symbol.replace("/", "_");

                        const isExitsScalp = this.whiteListScalpIoc.find((item) => item.symbol === symbol);
                        if (isExitsScalp) {
                            await this.handleWhiteListScalpIocNew(symbol, entry);
                        }

                        const isExitsFarm = this.whiteListFarmIoc.find((item) => item.symbol === symbol);
                        if (isExitsFarm) {
                            await this.handleWhiteListFarmIocNew(symbol, entry);
                        }
                    }

                    // ===== 4) SL / ROI ===================================================
                    if (this.isHandleSL()) {
                        for (const [, pos] of this.positions) {
                            await this.handleRoi(pos);
                        }
                    }
                    // this.reloadWebContentsViewRequest();
                }
            } catch (err: any) {
                this.logWorker().error(err?.message);
                if (this.isTimeoutError(err)) {
                    this.reloadWebContentsViewRequest();
                }
            } finally {
                const dt = Math.round(performance.now() - iterStart);
                this.count += 1;
                this.log(`✅✅✅✅✅ ITER END (took ${dt}ms) =====`);
                await this.sleep(1000);
            }
        }
    }

    private async handleDualMode(dualModeExpected: "oneway" | "hedged"): Promise<boolean> {
        // const account = this.accounts.find((item) => {
        //     return item.user === this.uidWeb;
        // });
        const account = this.accounts[0];
        if (!account) {
            this.logWorker().info("account not found");
            return false;
        }

        // oneway = false
        // hedged = true
        if (dualModeExpected === "oneway") {
            if (account.in_dual_mode === true) {
                await this.handleChangePositionMode({ mode: "oneway" });
                this.logWorker().info("hedged => oneway");
                return true;
            } else {
                return true;
            }
        } else {
            if (account.in_dual_mode === false) {
                await this.handleChangePositionMode({ mode: "hedged" });
                this.logWorker().info("oneway => hedged");
                return true;
            } else {
                return true;
            }
        }
    }

    private async handleWhiteListScalpIocNew(entrySymbol: string, entry: TWhiteListItem) {
        const keyDelay = `scalp:${entrySymbol}`;
        const keyPrevSidesCount = `scalp:${entrySymbol}`;

        if (this.settingUser.delayScalp > 0) {
            if (this.isCheckDelayForPairsMs(keyDelay)) {
                const mes = `🔵 Delay Scalp ${entrySymbol} ${this.cooldownLeft(keyDelay)}ms`;
                this.logWorker().info(mes);
                return;
            }
        }

        if (!entry.core.gate.sScalp) {
            const mes = `Skip Scalp ${entrySymbol}: By Not Found sScalp: ${entry.core.gate.sScalp}`;
            this.logWorker().info(mes);
            return;
        }

        const sideScalp = this.handleSideIOC(entry.core.gate.sScalp, keyPrevSidesCount);
        if (sideScalp === null) {
            const mes = `Skip Scalp ${entrySymbol}: By Hold`;
            this.logWorker().info(mes);
            return;
        }

        const maxSizeScalpIoc = this.whiteListScalpIoc.find((item) => item.symbol.replace("/", "_") === entrySymbol)?.maxSize;
        if (!maxSizeScalpIoc) {
            const mes = `Skip Scalp ${entrySymbol}: By Not Found Max Size: ${maxSizeScalpIoc}`;
            this.logWorker().info(mes);
            return;
        }

        let sizeScalpIoc = this.whiteListScalpIoc.find((item) => item.symbol.replace("/", "_") === entrySymbol)?.size;
        if (!sizeScalpIoc) {
            const mes = `Skip Scalp ${entrySymbol}: By Not Found size: ${sizeScalpIoc}`;
            this.logWorker().info(mes);
            return;
        }

        const isNextByMaxSize = this.checkMaxSize(entrySymbol, sideScalp, maxSizeScalpIoc);
        if (!isNextByMaxSize) return;

        // const bidsAsks = await this.getBidsAsks(entrySymbol);

        const indexBidAsk = Math.max(0, Math.min(4, this.settingUser.indexBidAsk - 1));
        // chỗ này sẽ để càng xa càng tốt là 0, 1, 2, 3, ... => để 2
        // càng xa càng khó khớp lệnh nên tạm thời để 0 để test
        const pricesScalp = entry.core.gate[sideScalp === "long" ? "bids" : "asks"][indexBidAsk];
        // const pricesScalps = bidsAsks[sideScalp === "long" ? "bids" : "asks"].slice(0, 2);

        if (!IS_PRODUCTION) sizeScalpIoc = 1;

        const payloadOpenOrder: TPayloadOrder = {
            contract: entrySymbol,
            size: sideScalp === "long" ? `${sizeScalpIoc}` : `-${sizeScalpIoc}`,
            price: pricesScalp.p,
            reduce_only: false,
            tif: "ioc",
        };

        const ok = await this.changeLeverageCross(entrySymbol, this.settingUser.leverage);
        if (!ok) return;

        const res = await this.openEntry(payloadOpenOrder, `🧨 Scalp IOC`);
        // this.logWorker().info(`🧨 ${entrySymbol} | ${sideScalp} | ${payloadOpenOrder.price}`);
        this.sideCountsIOC.set(keyPrevSidesCount, { keyPrevSidesCount, longHits: 0, shortHits: 0 });
        this.sendSideCountsIOC();

        if (this.settingUser.delayScalp > 0) {
            this.postponePair(keyDelay, this.settingUser.delayScalp);
        }
    }

    private async handleWhiteListFarmIocNew(entrySymbol: string, entry: TWhiteListItem) {
        const keyDelay = `farm:${entrySymbol}`;
        const keyPrevSidesCount = `farm:${entrySymbol}`;

        if (this.settingUser.delayFarm > 0) {
            if (this.isCheckDelayForPairsMs(keyDelay)) {
                const mes = `🔵 Delay Farm ${entrySymbol} ${this.cooldownLeft(keyDelay)}ms`;
                this.logWorker().info(mes);
                return;
            }
        }

        if (!entry.core.gate.sFarm) {
            const mes = `Skip Farm ${entrySymbol}: By Not Found sFarm: ${entry.core.gate.sFarm}`;
            this.logWorker().info(mes);
            return;
        }

        const sideFarm = this.handleSideIOC(entry.core.gate.sFarm, keyPrevSidesCount);
        if (sideFarm === null) {
            const mes = `Skip Farm ${entrySymbol}: By Hold`;
            this.logWorker().info(mes);
            return;
        }

        const maxSizeFarmIoc = this.whiteListFarmIoc.find((item) => item.symbol.replace("/", "_") === entrySymbol)?.maxSize;
        if (!maxSizeFarmIoc) {
            const mes = `Skip Farm ${entrySymbol}: By Not Found Max Size: ${maxSizeFarmIoc}`;
            this.logWorker().info(mes);
            return;
        }

        let sizeFarmIoc = this.whiteListFarmIoc.find((item) => item.symbol.replace("/", "_") === entrySymbol)?.size;
        if (!sizeFarmIoc) {
            const mes = `Skip Farm ${entrySymbol}: By Not Found size: ${sizeFarmIoc}`;
            this.logWorker().info(mes);
            return;
        }

        const isNextByMaxSize = this.checkMaxSize(entrySymbol, sideFarm, maxSizeFarmIoc);
        if (!isNextByMaxSize) return;

        // const bidsAsks = await this.getBidsAsks(entrySymbol);

        let price: any = entry.core.gate[sideFarm === "long" ? "bids" : "asks"][2].p;

        if (!IS_PRODUCTION) {
            sizeFarmIoc = 1;
            const tick = entry.contractInfo.order_price_round;
            const insidePrices = this.computeInsidePrices(sideFarm, entry.core.gate, tick, this.decimalsFromTick.bind(this));
            price = insidePrices.at(-1);
            if (!price) {
                const mes = `Skip Farm ${entrySymbol}: by not found price: ${price}`;
                this.logWorker().info(mes);
                return;
            }
        }

        const payloadOpenOrder: TPayloadOrder = {
            contract: entrySymbol,
            size: sideFarm === "long" ? `${sizeFarmIoc}` : `-${sizeFarmIoc}`,
            price: price,
            reduce_only: false,
            tif: "ioc",
        };

        const ok = await this.changeLeverageCross(entrySymbol, this.settingUser.leverage);
        if (!ok) return;

        await this.openEntry(payloadOpenOrder, `🧨 Farm IOC`);
        // this.logWorker().info(`🧨 ${entrySymbol} | ${sideFarm} | ${payloadOpenOrder.price}`);
        this.sideCountsIOC.set(keyPrevSidesCount, { keyPrevSidesCount, longHits: 0, shortHits: 0 });
        this.sendSideCountsIOC();

        if (this.settingUser.delayFarm > 0) {
            this.postponePair(keyDelay, this.settingUser.delayFarm);
        }
    }

    private syncMaxScapsPosition(positions: TPosition[]) {
        // Nếu không có position nào → xóa toàn bộ
        if (positions.length === 0) {
            this.maxScalpsPosition.clear();
            return;
        }

        // Nếu maxScalpsPosition đang trống → không cần làm gì
        if (this.maxScalpsPosition.size === 0) return;

        for (const key of this.maxScalpsPosition.keys()) {
            // Chuẩn hóa tên contract trong positions
            const exists = positions.some((pos) => pos.contract.replace("/", "_") === key.replace("/", "_"));

            if (!exists) {
                this.maxScalpsPosition.delete(key);
            }
        }
    }

    private syncMaxFarmsPosition(positions: TPosition[]) {
        // Nếu không có position nào → xóa toàn bộ
        if (positions.length === 0) {
            this.maxFarmsPosition.clear();
            return;
        }

        // Nếu maxFarmsPosition đang trống → không cần làm gì
        if (this.maxFarmsPosition.size === 0) return;

        for (const key of this.maxFarmsPosition.keys()) {
            // Chuẩn hóa tên contract trong positions
            const exists = positions.some((pos) => pos.contract.replace("/", "_") === key.replace("/", "_"));

            if (!exists) {
                this.maxFarmsPosition.delete(key);
            }
        }
    }

    private checkMaxSize(symbol: string, entrySide: TSide, maxSize: number): boolean {
        const position = this.positions.get(symbol);
        if (!position) {
            // nếu không có position là lệnh chưa được fill tiếp tục vào lệnh
            return true;
        }

        if (Math.abs(position.size) >= maxSize) {
            // nếu size của position lớn hơn 0 là long, thì tín hiệu phải là short mới vào
            // sideShoudBe sẽ là side mong muốn ngược với side position
            const sidePosition = position.size > 0 ? "long" : "short";
            const sideShoudBe = sidePosition === "long" ? "short" : "long";
            if (sideShoudBe !== entrySide) {
                const mes = `Position ${symbol} ${sidePosition} đã maxSize (${position.size}/${maxSize}): cần tín hiệu là ${sideShoudBe}`;
                if (this.settingUser.sizeIOC === 5) this.logWorker().info(mes);
                // this.logUnique("info", "all", mes);
                return false;
            } else {
                const mes = `Position ${symbol} ${sidePosition} đã maxSize (${position.size}/${maxSize}): đúng side cần ${sideShoudBe} => tiến hành vào lệnh`;
                if (this.settingUser.sizeIOC === 5) this.logWorker().info(mes);
                // this.logUnique("info", "all", mes);
                return true;
            }
        } else {
            // size của position nhỏ hơn maxSize thì tiếp tục vào lệnh
            return true;
        }
    }

    private async beforeEach() {
        this.heartbeat();
        // this.rateCounterSendRenderer();
        // await this.getUid();
        // this.checkUid();
        // await this.checkLoginGate();
        // await this.handleGetInfoGate();
        // await this.checkUid();
        // this.getSideCCC();
        // this.logWorker().log(`[RATE] hit limit; counts so far: ${JSON.stringify(this.rateCounter.counts())}`);
        // console.log(`positions`, Object(this.positions).keys());
        // console.log(`orderOpens`, this.orderOpens);
        // console.log(`settingUser`, this.settingUser);
        // console.log("startTimeSec", this.startTimeSec);
        // console.log("stepFixLiquidation", this.stepFixLiquidation);
        // console.log("dataFixLiquidation", this.dataFixLiquidation);
        // console.log("dataFixStopLoss", this.dataFixStopLoss);
        // console.log("fixStopLossQueue", this.fixStopLossQueue);
        // console.log("uidDB", this.uidDB);
        // console.log("whitelistEntry", this.whitelistEntry);
        // console.log("whiteListMartingale", this.whiteListMartingale);
        // console.log("whiteListFarmIoc", this.whiteListFarmIoc);
        // console.log("whiteListScalpIoc", this.whiteListScalpIoc);
        // console.dir(this.positions, { colors: true, depth: null });
        // console.log(`maxScalpsPosition`, Object(this.maxScalpsPosition).keys());
        // console.log(`maxFarmsPosition`, Object(this.maxFarmsPosition).keys());
        // console.log("whitelistEntryFarmIocNew", this.whitelistEntryFarmIocNew);
        // console.log("whitelistEntryScalpIocNew", this.whitelistEntryScalpIocNew);
        // console.log("nextOpenAt", this.nextOpenAt);
        // console.dir(this.sideCountsIOC, { colors: true, depth: null });
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

    // private rateCounterSendRenderer() {
    //     const payload: TWorkerData<Record<WindowKey, number>> = {
    //         type: "bot:rateCounter",
    //         payload: this.rateCounter.counts(),
    //     };
    //     this.parentPort?.postMessage(payload);
    // }

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

            // case "bot:blackList":
            //     this.setBlackList(msg.payload);
            //     break;

            case "bot:whiteListMartingale":
                // this.setWhiteListMartingale(msg.payload);
                break;

            case "bot:whiteListFarmIoc":
                this.setWhiteListFarmIoc(msg.payload);
                break;

            case "bot:whiteListScalpIoc":
                this.setWhiteListScalpIoc(msg.payload);
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

            // case "bot:rateMax:set":
            //     this.handleMaxRate(msg);
            //     break;

            // case "bot:takeProfitAccount":
            //     this.setTakeProfitAccount(msg);
            //     break;

            case "bot:removeFixStopLossQueue":
                // this.removeFixStopLossQueue(msg);
                break;

            case "bot:ioc:long":
                this.handleIOCLong();
                break;

            case "bot:ioc:short":
                this.handleIOCShort();
                break;

            case "bot:ioc:hedge":
                this.handleChangePositionMode({ mode: "hedged" });
                break;

            case "bot:ioc:oneway":
                this.handleChangePositionMode({ mode: "oneway" });
                break;

            default:
                break;
        }
    }

    private start(isNextPhase = true) {
        this.isStart = true;
        this.parentPort?.postMessage({ type: "bot:start", payload: { isStart: this.isStart, isNextPhase } });
        this.logWorker().info("🟢 Start");
    }

    private stop() {
        this.isStart = false;
        this.parentPort?.postMessage({ type: "bot:stop", payload: { isStart: this.isStart } });
        this.logWorker().info("🔴 Stop");
    }

    private sleep(ms: number) {
        return new Promise((r) => setTimeout(r, ms));
    }

    private setWhiteListFarmIoc(whiteListFarmIoc: TWhiteListFarmIoc[]) {
        this.whiteListFarmIoc = whiteListFarmIoc;
    }

    private setWhiteListScalpIoc(whiteListScalpIoc: TWhiteListScalpIoc[]) {
        this.whiteListScalpIoc = whiteListScalpIoc;
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

    private log(data?: any) {
        console.log(`[Bot] ${this.count}`, data);
    }

    private async changeLeverageCross(symbol: string, leverageNumber: number): Promise<boolean> {
        const changedLeverage = this.changedLaverageCrosslist.get(symbol);
        if (changedLeverage && changedLeverage.leverage === leverageNumber) {
            // this.log(`✅ Change Leverage [EXISTS] ${symbol} skip => `, this.changedLaveragelist);
            return true;
        }

        const leverageString = leverageNumber.toString();

        const url = `https://www.gate.com/apiw/v2/futures/usdt/positions/${symbol}/leverage`;

        const { body, error, ok } = await this.gateFetch<TGateApiRes<TChangeLeverage | null>>(url, {
            method: "POST",
            body: JSON.stringify({ cross_leverage_limit: leverageString, leverage: "0" }),
            headers: { "Content-Type": "application/json" },
        });

        if (ok === false || error || body === null) {
            const msg = `❌ Change Leverage Cross: ${error}`;
            throw new Error(msg);
        }

        const { code, data, message } = body;

        if (code >= 400 || code < 0) {
            const msg = `❌ Change Leverage Cross: ${symbol} | code:${code} | ${message}`;
            this.logWorker().error(msg);
            return false;
        }

        if (data === null || data === undefined) {
            const msg = `❌ Change Leverage Cross: data is ${data}`;
            throw new Error(msg);
        }

        if (data?.cross_leverage_limit !== leverageString) {
            const msg = `❌ Change Leverage: ${symbol} | mismatched leverage`;
            this.logWorker().error(msg);
            return false;
        }

        this.changedLaverageCrosslist.delete(symbol);
        this.changedLaverageCrosslist.set(symbol, { symbol, leverage: leverageNumber });
        const msg = `✅ Change Leverage Cross: ${symbol} | ${leverageString}`;
        this.logWorker().info(msg);

        return true;
    }

    private async openEntry(payload: TPayloadOrder, label: string) {
        if (Number(this.accounts[0].available || 0) <= 0) {
            const msg = `❌ ${payload.contract} - ${label} ${Number(payload.size) >= 0 ? "long" : "short"} | ${payload.size} | ${payload.price}: ${INSUFFICIENT_AVAILABLE}`;
            this.logWorker().error(msg);
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

        // this.rateCounter.startAttempt();

        const { body, error, ok } = await this.createOrder<TGateApiRes<TOrderOpen | null>>(payload, dataSelector);

        if ((body as any)?.label === TOO_MANY_REQUEST) {
            // this.rateCounter.rollback(ticket); // không tính lần attempt đụng limit
            // this.rateCounter.stop(); // từ giờ ngừng đếm

            const msg = `❌ ${payload.contract} - ${label} ${Number(payload.size) >= 0 ? "long" : "short"} | ${payload.size} | ${payload.price}: ${body?.message || TOO_MANY_REQUEST}`;
            this.logWorker().error(msg);

            // this.logWorker().warn(`[RATE] hit limit; counts so far: ${JSON.stringify(this.rateCounter.counts())}`);

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

        const status = `✅ ${payload.contract} - ${label} ${Number(payload.size) >= 0 ? "long" : "short"} | ${payload.size} | ${payload.price} | ${body.data.size - body.data.left}`;
        this.logWorker(ELogType.Trade).info(status);

        return body.data;
    }

    private seqOrder = 0;

    private async createOrder<T>(payload: TPayloadOrder, dataSelector: TUiSelectorOrder, timeoutMs = 10_000): Promise<TOrderWorkRes<T>> {
        const reqOrderId = ++this.seqOrder;
        const port = this.parentPort!;

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

                    const p: Omit<TGateOrderMainRes, "bodyText"> & { body: TGateApiRes<TOrderOpen | null> | null } = m.payload;
                    if (!p.ok || p.body === null) return done({ ok: false, body: null, error: p.error || "Order failed" }, "main→order:res !ok");


                    return done({ ok: true, body: p.body as T, error: null });
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

    private async clickMarketPostion(symbol: string, side: TSide) {
        const selectorWrapperPositionBlocks = this.uiSelector?.find((item) => item.code === "wrapperPositionBlocks")?.selectorValue;
        const selectorButtonTabPosition = this.uiSelector?.find((item) => item.code === "buttonTabPosition")?.selectorValue;

        if (!selectorWrapperPositionBlocks || !selectorButtonTabPosition) {
            this.log(`🟢 Not found selector ${{ selectorWrapperPositionBlocks, selectorButtonTabPosition }}`);
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

        this.logWorker(ELogType.Trade).info(`✅ 🤷 ${symbol} Click StopLoss Market Position`);
        return body;
    }

    private handleSideIOC(s: number, keyPrevSidesCount: string): TSide | null {
        const stepS = this.settingUser.stepS;
        // lấy / khởi tạo bộ đếm
        const rec = this.sideCountsIOC.get(keyPrevSidesCount) ?? {
            keyPrevSidesCount,
            longHits: 0,
            shortHits: 0,
        };

        let out: TSide | null = null;

        if (s > this.settingUser.tauS) {
            rec.longHits += 1;
            rec.shortHits = 0;

            if (rec.longHits >= stepS) {
                this.sideCountsIOC.set(keyPrevSidesCount, rec);
                this.sendSideCountsIOC();

                rec.longHits = 0; // reset để tránh bắn liên tục mỗi tick
                this.sideCountsIOC.set(keyPrevSidesCount, rec);
                out = "long"; // đủ N lần liên tiếp → bật tín hiệu long
                return out;
            }
        } else if (s < -this.settingUser.tauS) {
            rec.shortHits += 1;
            rec.longHits = 0;

            if (rec.shortHits >= stepS) {
                this.sideCountsIOC.set(keyPrevSidesCount, rec);
                this.sendSideCountsIOC();

                rec.shortHits = 0; // reset để tránh bắn liên tục mỗi tick
                this.sideCountsIOC.set(keyPrevSidesCount, rec);
                out = "short"; // đủ N lần liên tiếp → bật tín hiệu short
                return out;
            }
        } else {
            // rơi vào dead-band → reset cả hai phía (đếm LIÊN TIẾP đúng nghĩa)
            rec.longHits = 0;
            rec.shortHits = 0;
        }

        if (this.settingUser.tauS === undefined && this.settingUser.tauS === null) {
            rec.longHits = 0;
            rec.shortHits = 0;
            out = null;
        }

        this.sideCountsIOC.set(keyPrevSidesCount, rec);
        this.sendSideCountsIOC();
        return out; // "long" | "short" | null
    }

    private sendSideCountsIOC() {
        const payload: TWorkerData<{ sideCountItem: TSideCountsIOCitem[]; tauS: number; stepS: number }> = {
            type: "bot:ioc:sideCount",
            payload: {
                tauS: this.settingUser.tauS,
                sideCountItem: Array.from(this.sideCountsIOC.values()),
                stepS: this.settingUser.stepS,
            },
        };
        this.parentPort?.postMessage(payload);
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

    private decimalsFromTick(tick: number) {
        const s = String(tick);
        if (s.includes("e-")) return Number(s.split("e-")[1]);
        const i = s.indexOf(".");
        return i >= 0 ? s.length - i - 1 : 0;
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

    private async handleRoi(pos: TPosition): Promise<void> {
        const { stopLoss, stopLossUsdtPnl, timeoutEnabled, timeoutMs } = this.settingUser;

        // Nếu stopLoss = 100 (OFF) & stopLossUsdtPnl = 0 (OFF) => bỏ qua
        if (stopLoss >= 100 && stopLossUsdtPnl <= 0) {
            this.logWorker().info(`🟣 SL: skip — stopLoss=${stopLoss} >=100 & stopLossUsdtPnl=${stopLossUsdtPnl} <=0`);
            return;
        }

        const symbol = pos.contract.replace("/", "_");

        // 🔹 Lấy thông tin hợp đồng
        const info = await this.getInfoContract(symbol);
        if (!info) {
            this.logWorker().error(`🟣 ❌ SL ${symbol}: Get info contract fail`);
            return;
        }

        const size = Number(pos.size);
        const entryPrice = Number(pos.entry_price);
        const initial_margin = Number(pos.initial_margin);
        const quanto = Number(info.quanto_multiplier);
        const lastPrice = Number(await this.getLastPrice(symbol));
        const openTimeSec = Number(pos.open_time);
        const nowMs = Date.now();

        // 🔹 Kiểm tra dữ liệu hợp lệ
        if (!Number.isFinite(size) || size === 0) {
            return this.logWorker().error(`🟣 ❌ SL ${symbol}: Invalid size=${size}`);
        }
        if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
            return this.logWorker().error(`🟣 ❌ SL ${symbol}: Invalid entryPrice=${entryPrice}`);
        }
        if (!Number.isFinite(initial_margin) || initial_margin <= 0) {
            return this.logWorker().error(`🟣 ❌ SL ${symbol}: Invalid initial_margin=${initial_margin}`);
        }
        if (!Number.isFinite(quanto) || quanto <= 0) {
            return this.logWorker().error(`🟣 ❌ SL ${symbol}: Invalid quanto=${quanto}`);
        }
        if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
            return this.logWorker().error(`🟣 ❌ SL ${symbol}: Invalid lastPrice=${lastPrice}`);
        }

        // 🔹 Tính toán PnL và ROI
        const unrealizedPnL = (lastPrice - entryPrice) * size * quanto;
        const returnPercent = (unrealizedPnL / initial_margin) * 100;
        const createdAtMs = openTimeSec > 0 ? openTimeSec * 1000 : nowMs;

        // 🔹 Kiểm tra điều kiện StopLoss
        let isSL = false;
        let reason = "";

        const validSLPercent = stopLoss < 100; // stopLoss (%) hợp lệ
        const validSLUsdt = stopLossUsdtPnl > 0; // stopLoss theo USDT hợp lệ

        // So sánh phần trăm
        if (validSLPercent && returnPercent <= -stopLoss) {
            isSL = true;
            reason = `ROI=${returnPercent.toFixed(2)}% (<= -${stopLoss}%)`;
        }

        // So sánh theo USD nếu chưa kích hoạt bởi %
        if (!isSL && validSLUsdt && unrealizedPnL <= -stopLossUsdtPnl) {
            isSL = true;
            reason = `PnL=${unrealizedPnL.toFixed(2)} (<= -${stopLossUsdtPnl})`;
        }

        // Nếu cả hai hợp lệ thì xét cái nào đến trước
        if (validSLPercent && validSLUsdt) {
            const hitByPercent = returnPercent <= -stopLoss;
            const hitByUsdt = unrealizedPnL <= -stopLossUsdtPnl;
            if (hitByPercent || hitByUsdt) {
                isSL = true;
                reason = hitByPercent
                    ? `ROI=${returnPercent.toFixed(2)}% (<= -${stopLoss}%)`
                    : `PnL=${unrealizedPnL.toFixed(2)} (<= -${stopLossUsdtPnl})`;
            }
        }

        // 🔹 Kiểm tra timeout (nếu bật)
        const isTimedOut = timeoutEnabled && nowMs - createdAtMs >= timeoutMs;

        this.logWorker().info(
            `🟣 SL ${symbol}: ROI=${returnPercent.toFixed(2)}% | PnL=${unrealizedPnL.toFixed(2)} | SL%=${stopLoss} | SL$=${stopLossUsdtPnl} | ` +
                `isSL=${isSL} (${reason || "none"}) | isTimedOut=${isTimedOut}`,
        );

        // 🔹 Không có điều kiện nào kích hoạt → return
        if (!isSL && !isTimedOut) return;

        // 🔹 Kích hoạt StopLoss
        await this.clickMarketPostion(pos.contract, Number(pos.size) > 0 ? "long" : "short");

        return;
    }

    private setWhitelist(whiteList: TWhiteList) {
        // console.dir(whiteList, { colors: true, depth: null });
        this.whiteList = whiteList;
    }

    private setSettingUser(settingUser: TSettingUsers) {
        this.settingUser = settingUser;
    }

    private setUiSelector(settingUser: TUiSelector[]) {
        this.uiSelector = settingUser;
    }

    private reloadWebContentsViewRequest() {
        this.logWorker().info("🔄 Reload WebContentsView Request");
        let isStop = false;
        if (this.isStart) {
            this.stop();
            isStop = true;
        }
        this.parentPort?.postMessage({ type: "bot:reloadWebContentsView:Request", payload: { isStop } });
    }

    private async reloadWebContentsViewResponse({ isStop }: { isStop: boolean }) {
        this.logWorker().info("🔄 Reload WebContentsView Response");
        await this.sleep(2000);
        if (isStop) this.start(false);
        this.parentPort?.postMessage({ type: "bot:reloadWebContentsView", payload: true });
    }

    private handleFollowApi(payloadFollowApi: TPayloadFollowApi) {
        const { url, method, bodyText } = payloadFollowApi;

        const key = `${method} ${url}`;
        try {
            // console.log("handleFollowApi: ", payloadFollowApi);

            switch (key) {
                case `${FLOWS_API.acounts.method} ${FLOWS_API.acounts.url}`:
                    const bodyAccounts: TGateApiRes<TAccount[] | null> = JSON.parse(bodyText);
                    this.handleAccountWebGate(bodyAccounts.data || []);
                    break;

                case `${FLOWS_API.positions.method} ${FLOWS_API.positions.url}`:
                    const bodyPositions: TGateApiRes<TPosition[] | null> = JSON.parse(bodyText);

                    if (!bodyPositions.data || !Array.isArray(bodyPositions.data)) break;

                    const result = bodyPositions.data.filter((pos) => {
                        return Number(pos.size) !== 0;
                    });
                    this.replacePositions(result);
                    this.syncMaxScapsPosition(result);
                    this.syncMaxFarmsPosition(result);
                    break;

                default:
                    break;
            }
        } catch (error) {
            this.logWorker().error(`❌ handleFollowApi: ${key} ${String(error)}`);
        }
    }

    private shouldEmit(category: ELogType): boolean {
        const mode = this.settingUser?.logType;
        switch (mode) {
            case ELogType.Silent:
                return false; // tắt hết
            case ELogType.All:
                return true; // bật hết
            case ELogType.Trade:
                return category === ELogType.Trade; // chỉ log kênh Trade
            default:
                return false;
        }
    }

    private logWorker(category: ELogType = ELogType.All): LogFunctions {
        const send = (level: TWorkLog["level"], parts: any[]) => {
            if (!this.shouldEmit(category)) return;
            const payload: TWorkerData<TWorkLog> = {
                type: "bot:log",
                payload: {
                    level,
                    text: `PID:${process.pid}` + " " + parts.map(String).join(" "),
                },
            };
            parentPort?.postMessage(payload);
        };

        return {
            info: (...p: any[]) => send("info", p),
            error: (...p: any[]) => send("error", p),
            warn: (...p: any[]) => send("warn", p),
            debug: (...p: any[]) => send("debug", p),
            log: (...p: any[]) => send("info", p),
            silly: (...p: any[]) => send("silly", p),
            verbose: (...p: any[]) => send("verbose", p),
        };
    }

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

    private isCheckDelayForPairsMs(key: string) {
        const nextAt = this.nextOpenAt.get(key) || 0;
        return Date.now() < nextAt;
    }
    private cooldownLeft(key: string) {
        return Math.max(0, (this.nextOpenAt.get(key) || 0) - Date.now());
    }
    private postponePair(key: string, delayForPairsMs: number) {
        if (delayForPairsMs) {
            this.nextOpenAt.set(key, Date.now() + delayForPairsMs);
        }
    }

    private isHandleSL() {
        // 1) Không có position -> không cần check SL
        if (this.positions.size === 0) {
            this.logWorker().info("🟣 SL: skip — no positions");
            console.log("🟣 SL: skip — no positions");
            return false;
        }

        return true;
    }

    private handleAccountWebGate(accounts: TAccount[]) {
        this.accounts = accounts;
        this.parentPort?.postMessage({ type: "bot:saveAccount", payload: this.accounts });
    }

    // private handleMaxRate(message: TWorkerData<Record<WindowKey, number>>) {
    //     const incomingMaxByWindow = message.payload as Record<string, number>;

    //     // Sanitize từng window và ghép vào cấu hình hiện tại
    //     const updatedMaxByWindow: Record<WindowKey, number> = { ...this.rateMax };

    //     (Object.keys(updatedMaxByWindow) as WindowKey[]).forEach((windowKey) => {
    //         const rawValue = incomingMaxByWindow[windowKey];
    //         const normalizedMax = Math.max(0, Number(rawValue ?? 0));
    //         updatedMaxByWindow[windowKey] = Number.isFinite(normalizedMax) ? normalizedMax : 0;
    //     });

    //     this.rateMax = updatedMaxByWindow;
    // }

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

    private async checkLoginGate() {
        const selectorCheckLogin = this.uiSelector?.find((item) => item.code === "checkLogin")?.selectorValue;

        if (!selectorCheckLogin) {
            this.logWorker().info(`❌ Not found selector checkLogin`);
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

        this.logWorker().info(`✅ Check Login`);

        return body;
    }

    private async getUid() {
        const selectorGetUid = this.uiSelector?.find((item) => item.code === "getUid")?.selectorValue;

        if (!selectorGetUid) {
            this.logWorker().info(`❌ Not found selector getUid`);
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
                this.logWorker().info("❌ Not logined to gate");
            }
            this.uidWeb = null;
        } else {
            if (!this.uidWeb) {
                this.logWorker().info("✅ Logined to gate");
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

    private async handleChangePositionMode({ mode }: { mode: "hedged" | "oneway" }) {
        const url = `https://www.gate.com/apiw/v2/futures/usdt/dual_mode`;

        const { body, error, ok } = await this.gateFetch<TGateApiRes<TChangeLeverage[] | null>>(url, {
            method: "POST",
            body: JSON.stringify({ dual_mode: mode === "hedged" ? true : false }),
            headers: { "Content-Type": "application/json" },
        });
        if (ok === false || error || body === null) {
            const msg = `❌ Change Hedge: ${error}`;
            throw new Error(msg);
        }

        const { code, data, message } = body;

        if (code >= 400 || code < 0) {
            const msg = `❌ Change Hedge: code:${code} | ${message}`;
            this.logWorker().error(msg);
            return false;
        }

        if (data === null || data === undefined) {
            const msg = `❌ Change Hedge: data is ${data}`;
            throw new Error(msg);
        }

        return true;
    }

    private async handleIOCLong() {
        const bidsAsks = await this.getBidsAsks("H_USDT");

        const asksToLong = bidsAsks["asks"];

        for (let index = 0; index < 3; index++) {
            const element = asksToLong[index];
            const payloadOpenOrder: TPayloadOrder = {
                contract: "H_USDT",
                size: "1",
                price: element.p,
                reduce_only: false,
                tif: "ioc",
            };

            const res = await this.openEntry(payloadOpenOrder, `🧨 ${element.p}`);
        }
    }

    private async handleIOCShort() {
        const bidsAsks = await this.getBidsAsks("H_USDT");

        const bidsToShort = bidsAsks["bids"];

        for (let index = 0; index < 3; index++) {
            const element = bidsToShort[index];
            const payloadOpenOrder: TPayloadOrder = {
                contract: "H_USDT",
                size: "-1",
                price: element.p,
                reduce_only: false,
                tif: "ioc",
            };

            const res = await this.openEntry(payloadOpenOrder, `🧨 ${element.p}`);
        }
    }

    private toNum(x: string | number): number {
        return typeof x === "number" ? x : parseFloat(x);
    }

    private roundToTick(x: number, tick: number, decimals: number): number {
        // Đưa về lưới tick rồi format đúng số lẻ
        const stepped = Math.round(x / tick) * tick;
        // tránh lỗi 0.1+0.2 => 0.30000000000004
        return Number(stepped.toFixed(decimals));
    }

    private computeInsidePrices(
        side: TSide,
        bidsAsks: {
            bids: { s: number; p: string }[];
            asks: { s: number; p: string }[];
        },
        order_price_round: number | string,
        decimalsFromTick: (tick: number) => number,
    ): string[] {
        const tick = this.toNum(order_price_round);
        const dec = decimalsFromTick(tick);

        const bestBid = bidsAsks.bids?.length ? this.toNum(bidsAsks.bids[0].p) : NaN;
        const bestAsk = bidsAsks.asks?.length ? this.toNum(bidsAsks.asks[0].p) : NaN;

        if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) return [];

        const prices: number[] = [];

        if (side === "long") {
            // từ bestBid tiến dần về ask
            for (let k = 1; k <= 3; k++) {
                let p = bestBid + k * tick;
                // không vượt qua ask (giữ strictly inside nếu có spread)
                if (bestAsk > bestBid) p = Math.min(p, bestAsk - tick);
                p = this.roundToTick(p, tick, dec);
                prices.push(p);
            }
        } else {
            // short: từ bestAsk tiến dần về bid
            for (let k = 1; k <= 3; k++) {
                let p = bestAsk - k * tick;
                if (bestAsk > bestBid) p = Math.max(p, bestBid + tick);
                p = this.roundToTick(p, tick, dec);
                prices.push(p);
            }
        }

        // loại trùng & chuyển về string đúng số lẻ
        const uniq = Array.from(new Set(prices))
            .filter((p) => Number.isFinite(p))
            .map((p) => p.toFixed(dec));

        return uniq;
    }
}
