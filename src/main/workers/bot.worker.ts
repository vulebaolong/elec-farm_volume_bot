// bot.worker.ts
import { IS_PRODUCTION } from "@/constant/app.constant";
import { TGateApiRes } from "@/types/base-gate.type";
import { TDataInitBot } from "@/types/bot.type";
import { TOrderOpen } from "@/types/order.type";
import { TPosition, TPositionRes } from "@/types/position.type";
import { TSettingUsers } from "@/types/setting-user.type";
import { TUiSelector } from "@/types/ui-selector.type";
import { TWhiteList, TWhitelistEntry } from "@/types/white-list.type";
import { TWorkerData } from "@/types/worker.type";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { parentPort, threadId } from "node:worker_threads";
import v8 from "v8";
import { checkSize, handleSize, isDepthCalc, isSpreadPercent } from "./util-bot.worker";

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

    // state
    private whitelistEntry: TWhitelistEntry[] = [];
    private whiteList: TWhiteList = {};
    private positions = new Map<string, TPosition>();
    private orderOpens: TOrderOpen[] = [];
    private changedLaveragelist: Set<string> = new Set();

    private settingUser: TSettingUsers;
    private uiSelector: TUiSelector[];

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

        while (this.running) {
            this.beforeEach();

            const iterStart = performance.now();
            this.log("\n\n\n\n\n");
            this.log("✅✅✅✅✅ ITER START =====", this.snapshot());

            try {
                if (this.isStart) {
                    let isRefresh = true;

                    // ===== 2) CREATE OPEN =====
                    // this.log("🔵🔵🔵🔵🔵 Create Open");
                    // if (this.isCheckwhitelistEntryEmty() && this.isCheckMaxOpenPO()) {
                    //     for (const whitelistItem of Object.values(this.whitelistEntry)) {
                    //         const { symbol, sizeStr, side, bidBest, askBest, order_price_round } = whitelistItem;

                    //         // nếu đã max thì không vào thoát vòng lặp
                    //         if (!this.isCheckMaxOpenPO()) {
                    //             this.log(`Create Open: break by maxTotalOpenPO: ${this.settingUser.maxTotalOpenPO}`);
                    //             break;
                    //         }

                    //         // nếu symbol đó đã tồn tại trong orderOpens -> bỏ qua
                    //         if (this.isOrderExitsByContract(symbol)) {
                    //             this.log(`Create Open: skip ${symbol} (already exists)`);
                    //             continue;
                    //         }

                    //         this.log(`Create Open: ${symbol} ok (not exists)`);
                    //         this.log(`Create Open: side=${side}`);
                    //         this.log(`Create Open: sizeStr=${sizeStr}`);

                    //         // Đổi leverage trước khi vào lệnh
                    //         this.log("Create Open: change leverage…");
                    //         const ok = await this.changeLeverage(symbol, this.settingUser.leverage);
                    //         if (!ok) {
                    //             this.log("Create Open: change leverage failed");
                    //             continue;
                    //         }
                    //         this.log("Create Open: leverage ok");

                    //         // console.log({
                    //         //     bidBest: bidBest,
                    //         //     askBest: askBest,
                    //         //     order_price_round: order_price_round,
                    //         // });

                    //         // const bidsAsks = await this.getBidsAsks(symbol);

                    //         // const prices = bidsAsks[side === "long" ? "bids" : "asks"].slice(1, 5 + 1);

                    //         // // const prices = this.ladderPrices(
                    //         // //     side, // "long" hoặc "short"
                    //         // //     {
                    //         // //         bidBest: bidBest,
                    //         // //         askBest: askBest,
                    //         // //         order_price_round: order_price_round,
                    //         // //     },
                    //         // //     5,
                    //         // //     5,
                    //         // // );
                    //         // this.log(`Create Open: ${prices.length} ladder order(s)`, prices);

                    //         // for (const price of prices) {
                    //         //     const payloadOpenOrder: TPayloadClickOpenPostOnlyEntry = {
                    //         //         symbol,
                    //         //         size: side === "long" ? sizeStr : `-${sizeStr}`,
                    //         //         price: price.p,
                    //         //         reduce_only: false, // false là lệnh open
                    //         //     };
                    //         //     this.log("Create Open: openEntry()", payloadOpenOrder);
                    //         //     await this.withTimeout(this.openEntry(payloadOpenOrder, `Open`), 10_000, `Open: openEntry(open ${symbol})`);
                    //         // }

                    //         // // refresh để lần lặp sau không đặt trùng
                    //         // await this.refreshSnapshot("Create Open");

                    //         // this.log("✅ Create Open: done for symbol", symbol);
                    //     }
                    // } else {
                    //     this.log(`Create Open: skipped by isCheckwhitelistEntryEmty and isCheckMaxOpenPO`);
                    // }
                    // this.log("🔵🔵🔵🔵🔵 Create Open");
                    // console.log("\n\n");

                    if (isRefresh) {
                        await this.refreshSnapshot("Refresh");
                        this.log("✅ Refresh End: done");
                    }
                } else {
                    this.log("isHandle=false → skip all work");
                }
            } catch (err) {
                await this.refreshSnapshot("Err");

                this.log("❌❌❌❌❌ ITER ERROR =====", err);
            }

            const dt = Math.round(performance.now() - iterStart);
            this.count += 1;
            this.log(`✅✅✅✅✅ ITER END (took ${dt}ms) =====`, "");

            await this.sleep(1_000);
        }
    }

    private isReady() {
        const data: TWorkerData<{ isReady: boolean }> = {
            type: "bot:isReady",
            payload: { isReady: true },
        };
        this.parentPort?.postMessage(data);
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

    private beforeEach() {
        this.parentPort?.postMessage({
            type: "bot:heartbeat",
            payload: {
                ts: Date.now(),
                isStart: this.isStart,
            },
        });

        this.parentPort?.postMessage({ type: "bot:metrics", payload: snapshotWorkerMetrics() });

        this.setWhitelistEntry();
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
                this.log(`[${symbol ?? "UNKNOWN"}] core thiếu field: ${JSON.stringify(core)}`);
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

    private isCheckwhitelistEntryEmty() {
        if (this.whitelistEntry.length <= 0) {
            this.log(`whitelistEntry rỗng => không xử lý whitelistEntry`, this.whitelistEntry.length);
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

    async getOrderOpens() {
        const { body } = await this.gateFetch("https://www.gate.com/apiw/v2/futures/usdt/orders?contract=&status=open");
        const { data: orderOpens, code: codeOrderOpen, message: messageOrderOpen }: TGateApiRes<TOrderOpen[] | null> = JSON.parse(body);
        if (codeOrderOpen >= 400) throw new Error(`Lỗi code >= 400 khi gọi createCodeStringGetOrderOpens: ${messageOrderOpen}`);
        // console.log({ "orderOpen hoàn thành": orderOpens });
        return orderOpens;
    }

    /** Làm mới orderOpens kèm timeout & log */
    private async refreshOrderOpens(ctx = "Refresh"): Promise<void> {
        const orderOpens = await this.getOrderOpens();
        this.setOrderOpens(orderOpens || []);
        this.log(`${ctx}: refresh orderOpens`);
    }

    private async getPositions() {
        const { body } = await this.gateFetch("https://www.gate.com/apiw/v2/futures/usdt/positions");
        const { data: positions, code: codePosition, message: messagePosition }: TPositionRes = JSON.parse(body);
        if (codePosition >= 400) throw new Error(`Lỗi code >= 400 khi gọi getPosition: ${messagePosition}`);
        // console.log({ "getPosition hoàn thành": positions });
        if (!positions) return [];
        const openPositionsList = positions.filter((pos) => Number(pos.size) !== 0);
        return openPositionsList;
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

    /** Bọc promise với timeout + log để xác định điểm treo */
    private async withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
        let timer: any;
        try {
            return await Promise.race([
                p,
                new Promise<T>((_, rej) => {
                    timer = setTimeout(() => rej(new Error(`❌❌❌❌❌ Timeout @ ${label} after ${ms}ms`)), ms);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
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

    private seq = 0;
    private gateFetch(url: string, init?: any): Promise<{ ok: boolean; status: number; body: string }> {
        const reqId = ++this.seq;
        const data: TWorkerData<{ url: string; init?: any; reqId: number }> = {
            type: "bot:fetch",
            payload: { url, init, reqId },
        };
        this.parentPort?.postMessage(data);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                parentPort!.off("message", onMsg);
                reject(new Error("gateFetch timeout"));
            }, 15000);

            const onMsg = (m: any) => {
                if (m?.type === "bot:fetch:res" && m.payload.reqId === reqId) {
                    clearTimeout(timeout);
                    parentPort!.off("message", onMsg);
                    if (m.payload.error) {
                        reject(new Error(m.payload.error));
                    } else {
                        resolve(m.payload.res);
                    }
                }
            };
            parentPort!.on("message", onMsg);
        });
    }

    private snapshot() {
        return {
            whitelistEntry: this.whitelistEntry,
        };
    }

    private log(step: string, data?: any) {
        const ts = new Date().toISOString();
        if (data !== undefined) this.log(`[Bot][${ts}] ${step}`, data);
        else this.log(`[Bot][${ts}] ${step}`);
    }

    private isOrderExitsByContract(contract: string): boolean {
        const isExitsOrderOpens = !!this.orderOpens.find((item) => item.contract === contract.replace("_", "/") && !item.is_reduce_only);
        if (isExitsOrderOpens) console.log(`${contract} đã tồn tại trong orderOpens => bỏ qua | isExitsOrderOpens: ${isExitsOrderOpens}`);

        // console.log("contract: ", contract);
        const isExitsPosition = this.positions.has(contract);
        if (isExitsPosition) console.log(`${contract} tồn tại trong position => bỏ qua | isExitsPosition: ${isExitsPosition}`);

        const isExits = isExitsOrderOpens || isExitsPosition;

        return isExits;
    }

    private async changeLeverage(symbol: string, leverageNumber: number): Promise<boolean> {
        // console.log(`changedLaveragelist: ${symbol}`, changedLaveragelist, changedLaveragelist.has(symbol));
        if (!this.changedLaveragelist.has(symbol)) {
            try {
                const leverageString = leverageNumber.toString();

                const { body } = await this.gateFetch(`/apiw/v2/futures/usdt/positions/${symbol}/leverage`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ leverage: leverageString }),
                });
                const { data, code, message }: TGateApiRes<any> = JSON.parse(body);
                if (code >= 400) throw new Error(`Lỗi code >= 400 khi gọi changeLeverage: ${message}`);

                console.log({ data });

                this.changedLaveragelist.add(symbol);
                if (!IS_PRODUCTION) {
                    this.log(`Change Leverage Successfully: ${symbol} - ${leverageString}`);
                }
                return true;
            } catch (error) {
                this.log(`Change Leverage Failed: ${symbol}`);
                return false; // ⛔ Dừng hẳn, không vào lệnh
            }
        } else {
            this.log(`Đã tồn tại ${symbol} trong changedLaveragelist => bỏ qua`, this.changedLaveragelist);
            return true;
        }
    }
}

const el = monitorEventLoopDelay({ resolution: 20 });
el.enable();
function snapshotWorkerMetrics() {
    const heap = process.memoryUsage(); // heapUsed là isolate của worker
    return {
        threadId,
        ts: Date.now(),
        heapUsed: heap.heapUsed, // bytes
        heapTotal: heap.heapTotal, // bytes
        v8: v8.getHeapStatistics(), // isolate stats của worker
        eventLoop: {
            mean: el.mean / 1e6, // ms
            max: el.max / 1e6,
            p95: el.percentile(95) / 1e6,
        },
    };
}
