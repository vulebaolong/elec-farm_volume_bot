import DescriptionCloseEntry from "@/components/description-entry/description-close-entry";
import DescriptionOpenEntry from "@/components/description-entry/description-open-entry";
import { IS_PRODUCTION } from "@/constant/app.constant";
import { changeLeverageHandler } from "@/helpers/change-leverage-handler.helper";
import { tryJSONparse } from "@/helpers/function.helper";
import {
    closeOrder,
    createCodeStringGetMyTrades,
    createCodeStringGetOrderOpens,
    createCodeStringGetPositions,
    openOrderPostOnly,
    TCloseOrder,
    TOpenOrderPostOnly,
} from "@/javascript-string/logic-farm";
import { TRespnoseGate, TSide } from "@/types/base.type";
import { TContract } from "@/types/contract.type";
import { TPayloadClickOpenEntry, TPayloadClickOpenPostOnlyEntry } from "@/types/entry.type";
import { Book, TGetMyTradesRes, TMyTrade } from "@/types/my-trade.type";
import { TEntryOrderOpenRes, TGetOrderOpenRes, TOrderOpen } from "@/types/order.type";
import { TPosition, TPositionRes } from "@/types/position.type";
import { TPayload24Change, TPriority } from "@/types/priority-change.type";
import { TSettingUsers } from "@/types/setting-user.type";
import { TSymbols } from "@/types/symbol.type";
import { TUiSelector } from "@/types/ui-selector.type";
import { TWhiteList, TWhitelistEntry, TWhiteListItem } from "@/types/white-list.type";
import { toast } from "sonner";

/**
 * reduce_only
 *  - true: là lệnh đóng
 *  - false: lệnh open
 */

type TaskInfo = {
    type: string;
    contract: string;
};

export type TBotConfig = {
    uiSelector: TUiSelector[];
    settingUser: TSettingUsers;
    priority24hChange: TPayload24Change;
    contracts: Map<string, TContract>;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type TNewBot = {
    configBot: TBotConfig;
    webview: Electron.WebviewTag;
    orderOpens: TOrderOpen[] | null;
    positions: TPosition[];
};

export class Bot {
    static async getPositions(webview: Electron.WebviewTag) {
        const stringPosition = createCodeStringGetPositions();
        const { data: positions, code: codePosition, message: messagePosition }: TPositionRes = await webview.executeJavaScript(stringPosition);
        if (codePosition >= 400) throw new Error(`Lỗi code >= 400 khi gọi getPosition: ${messagePosition}`);
        console.log({ "getPosition hoàn thành": positions });
        if (!positions) return [];
        const openPositionsList = positions.filter((pos) => Number(pos.size) !== 0);
        return openPositionsList;
    }

    static async getOrderOpens(webview: Electron.WebviewTag) {
        const stringOrderOpen = createCodeStringGetOrderOpens();
        const {
            data: orderOpens,
            code: codeOrderOpen,
            message: messageOrderOpen,
        }: TGetOrderOpenRes = await webview.executeJavaScript(stringOrderOpen);
        if (codeOrderOpen >= 400) throw new Error(`Lỗi code >= 400 khi gọi createCodeStringGetOrderOpens: ${messageOrderOpen}`);
        console.log({ "orderOpen hoàn thành": orderOpens });
        return orderOpens;
    }

    static async getMyTrades(webview: Electron.WebviewTag, start_time: number) {
        const stringMyTrades = createCodeStringGetMyTrades(start_time);
        const { data: myTrades, code: codeMyTrades, message: messageMyTrades }: TGetMyTradesRes = await webview.executeJavaScript(stringMyTrades);
        if (codeMyTrades >= 400) throw new Error(`Lỗi code >= 400 khi gọi createCodeStringGetmyTrades: ${messageMyTrades}`);
        console.log({ "getMyTrades hoàn thành": myTrades });
        return myTrades;
    }

    static checkSize(size: string | null | undefined): boolean {
        if (typeof size !== "string") return false;
        const s = size.trim();
        return /^[1-9]\d*$/.test(s);
    }

    private count = 0;
    private cursorTimeSeconds = Math.floor(Date.now() / 1000);
    private seenTradeIds = new Set<string>();
    private configBot: TBotConfig;
    private webview: Electron.WebviewTag;

    private positions = new Map<string, TPosition>();
    private orderOpens: TOrderOpen[];
    private whitelistEntry: TWhitelistEntry[] = []; // chỉ chứa các symbol vào lệnh
    private whiteList: TWhiteList = {};
    private symbolForClosePosition: TSymbols = {}; // chứa các symbol để có thông tin thoát lệnh, hiện tại đang cần lastPrice

    private isHandle: boolean = false;

    private running = false;

    constructor(newBot: TNewBot) {
        // copy để tránh bị mutate từ bên ngoài
        this.configBot = { ...newBot.configBot };
        this.webview = newBot.webview;
        this.orderOpens = newBot.orderOpens || [];
        this.replacePositions(newBot.positions);
    }

    setIsHandle(isHandle: boolean) {
        this.isHandle = isHandle;
    }

    update(cfg: TBotConfig) {
        this.configBot = cfg;
    }

    async start() {
        if (this.running) {
            this.log("start() ignored: already running");
            return;
        }
        this.running = true;

        try {
            while (true) {
                const iterStart = performance.now();
                this.log("✅✅✅✅✅ ITER START =====", this.snapshot());

                try {
                    if (this.isHandle) {
                        // ===== 1) CREATE CLOSE =====
                        // this.log("🟡🟡🟡🟡🟡 Create Close");
                        // const orderOpenFilled = await this.openFillWatcher();
                        // if (orderOpenFilled && orderOpenFilled.length > 0) {
                        //     for (const openFilled of orderOpenFilled) {
                        //         const tickSize = this.configBot.contracts.get(openFilled.contract.replace("/", "_"))?.order_price_round;
                        //         if (!tickSize) continue;

                        //         const sideFortpPrice = openFilled.size >= 0 ? "long" : "short";
                        //         const price = this.tpPrice(Number(openFilled.price), this.settingUser.takeProfit / 100, sideFortpPrice, tickSize);

                        //         const payload = {
                        //             symbol: openFilled.contract.replace("/", "_"),
                        //             size: openFilled.size > 0 ? String(-openFilled.size) : String(openFilled.size),
                        //             price: price,
                        //             reduce_only: true, // true là lệnh close
                        //         };
                        //         console.log(`openFilled`, openFilled);
                        //         this.log("Create Close: openEntry()", payload);
                        //         await this.withTimeout(this.openEntry(payload), 10_000, `Create Close: openEntry(Create Close ${payload.symbol})`);
                        //     }

                        //     this.log("Create Close: refresh orderOpens");
                        //     const oo = await this.withTimeout(Bot.getOrderOpens(this.webview), 10_000, "Create Close: getOrderOpens");
                        //     this.setOrderOpens(oo);

                        //     this.log("Create Close: refresh positions");
                        //     const pos = await this.withTimeout(Bot.getPositions(this.webview), 10_000, "Create Close: getPositions");
                        //     this.replacePositions(pos);

                        //     this.log("✅ Create Close: done build payloads…");
                        // } else {
                        //     this.log("Create Close: no positions");
                        // }
                        // this.log("🟡🟡🟡🟡🟡 Create Close");
                        // console.log("\n\n");

                        let isRefresh = true;

                        // ===== 1) CREATE CLOSE =====
                        this.log("🟡🟡🟡🟡🟡 Create Close");
                        if (this.positions.size > 0) {
                            const payloads = this.getCloseOrderPayloads(); // 1 bước: tính + build payload

                            for (const p of payloads) {
                                console.log("Đặt close order:", p);
                                await this.withTimeout(this.openEntry(p), 10_000, `Create Close: openEntry(Create Close ${p.symbol})`);
                                // refresh để lần lặp sau không đặt trùng
                                this.log("Create Close: refresh orderOpens");
                                const oo = await this.withTimeout(Bot.getOrderOpens(this.webview), 10_000, "Create Close: getOrderOpens");
                                this.setOrderOpens(oo);

                                this.log("Create Close: refresh positions");
                                const pos = await this.withTimeout(Bot.getPositions(this.webview), 10_000, "Create Close: getPositions");
                                this.replacePositions(pos);
                            }

                            this.log("✅ Create Close: done build payloads…");

                            isRefresh = false;
                        } else {
                            this.log("Create Close: no positions");
                        }
                        this.log("🟡🟡🟡🟡🟡 Create Close");

                        // ===== 2) OPEN =====
                        this.log("🔵🔵🔵🔵🔵 Open");
                        if (this.isCheckwhitelistEntry()) {
                            for (const whitelistItem of Object.values(this.whitelistEntry)) {
                                const { symbol, sizeStr, side, bidBest, askBest, order_price_round } = whitelistItem;

                                // nếu symbol đó đã tồn tại trong orderOpens -> bỏ qua
                                if (this.isOrderExitsByContract(symbol)) {
                                    this.log(`Open: skip ${symbol} (already exists)`);
                                    continue;
                                }
                                this.log(`Open: ${symbol} ok (not exists)`);
                                this.log(`Open: side=${side}`);
                                this.log(`Open: sizeStr=${sizeStr}`);

                                // Đổi leverage trước khi vào lệnh
                                this.log("Open: change leverage…");
                                const ok = await this.withTimeout(
                                    changeLeverageHandler({ symbol, leverageNumber: this.settingUser.leverage, webview: this.webview }),
                                    10_000,
                                    `Open: changeLeverage(${symbol})`,
                                );
                                if (!ok) {
                                    this.log("Open: change leverage failed");
                                    continue;
                                }
                                this.log("Open: leverage ok");

                                console.log({
                                    bidBest: bidBest,
                                    askBest: askBest,
                                    order_price_round: order_price_round,
                                });

                                const prices = this.ladderPrices(
                                    side, // "long" hoặc "short"
                                    {
                                        bidBest: bidBest,
                                        askBest: askBest,
                                        order_price_round: order_price_round,
                                    },
                                    5,
                                    5,
                                );
                                this.log(`Open: ${prices.length} ladder order(s)`, prices);

                                for (const price of prices) {
                                    const payloadOpenOrder: TPayloadClickOpenPostOnlyEntry = {
                                        symbol,
                                        size: side === "long" ? sizeStr : `-${sizeStr}`,
                                        price: price,
                                        reduce_only: false, // false là lệnh open
                                    };
                                    this.log("Open: openEntry()", payloadOpenOrder);
                                    await this.withTimeout(this.openEntry(payloadOpenOrder), 10_000, `Open: openEntry(open ${symbol})`);
                                }

                                // refresh để lần lặp sau không đặt trùng
                                this.log("Open: refresh orderOpens");
                                const oo = await this.withTimeout(Bot.getOrderOpens(this.webview), 10_000, "Open: getOrderOpens");
                                this.setOrderOpens(oo);

                                this.log("Open: refresh positions");
                                const pos = await this.withTimeout(Bot.getPositions(this.webview), 10_000, "Open: getPositions");
                                this.replacePositions(pos);

                                this.log("✅ Open: done for symbol", symbol);
                            }
                        } else {
                            this.log("Open: skipped by guard");
                        }
                        this.log("🔵🔵🔵🔵🔵 Open");
                        console.log("\n\n");

                        // ===== 3) SL / ROI =====
                        this.log("🟣🟣🟣🟣🟣 SL/ROI");
                        if (this.positions.size > 0) {
                            await this.handleRoi();

                            // refresh để lần lặp sau không đặt trùng
                            this.log("Roi: refresh orderOpens");
                            const oo = await this.withTimeout(Bot.getOrderOpens(this.webview), 10_000, "Roi: getOrderOpens");
                            this.setOrderOpens(oo);

                            this.log("Roi: refresh positions");
                            const po = await this.withTimeout(Bot.getPositions(this.webview), 10_000, "Roi: getPositions");
                            this.replacePositions(po);

                            this.log("✅ Roi: done");

                            isRefresh = false;
                        } else {
                            this.log("SL/ROI: no positions");
                        }
                        this.log("🟣🟣🟣🟣🟣 SL/ROI");
                        console.log("\n\n");

                        if (isRefresh) {
                            this.log("Refresh: refresh orderOpens");
                            const oo = await this.withTimeout(Bot.getOrderOpens(this.webview), 10_000, "Refresh: getOrderOpens");
                            this.setOrderOpens(oo);

                            this.log("Refresh: refresh positions");
                            const po = await this.withTimeout(Bot.getPositions(this.webview), 10_000, "Refresh: getPositions");
                            this.replacePositions(po);

                            this.log("✅ Refresh End: done");
                        }

                        console.log("\n\n");
                    } else {
                        this.log("isHandle=false → skip all work");
                    }
                } catch (err) {
                    this.log("❌❌❌❌❌ ITER ERROR =====", err);
                }

                const dt = Math.round(performance.now() - iterStart);
                this.count += 1;
                this.log(`✅✅✅✅✅ ITER END (took ${dt}ms) =====`, "");
                console.log("\n\n\n\n\n");

                await sleep(IS_PRODUCTION ? 1_000 : 1_000);
            }
        } finally {
            this.running = false;
        }
    }

    stop() {
        this.running = false;
    }

    async openEntry(payload: TPayloadClickOpenPostOnlyEntry) {
        let handler: any;

        try {
            const selectorInputPosition = this.uiSelector?.find((item) => item.code === "inputPosition")?.selectorValue;
            const selectorInputPrice = this.uiSelector?.find((item) => item.code === "inputPrice")?.selectorValue;
            const selectorButtonLong = this.uiSelector?.find((item) => item.code === "buttonLong")?.selectorValue;
            if (!selectorInputPosition || !selectorButtonLong || !selectorInputPrice) {
                console.log(`Not found selector`, { selectorInputPosition, selectorButtonLong, selectorInputPrice });
                throw new Error(`Not found selector`);
            }

            const waitForOrder = new Promise((resolve: (value: TRespnoseGate<any>) => void) => {
                handler = (event: any) => {
                    const chanel = event.channel;
                    const data = event.args?.[0];
                    if (chanel === "api-response" && data.url === "/apiw/v2/futures/usdt/orders") {
                        const dataFull: TRespnoseGate<any> = tryJSONparse(data.bodyPreview);
                        // this.webview.removeEventListener("ipc-message", handler);
                        resolve(dataFull);
                    }
                };
                this.webview.addEventListener("ipc-message", handler);
            });

            const payloadForOpenOrder: TOpenOrderPostOnly = {
                symbol: payload.symbol,
                size: payload.size,
                price: payload.price,
                reduce_only: payload.reduce_only,
                selector: {
                    buttonLong: selectorButtonLong,
                    inputPrice: selectorInputPrice,
                    inputPosition: selectorInputPosition,
                },
            };

            // console.log("payloadForOpenOrder: ", payloadForOpenOrder);

            const stringOrder = openOrderPostOnly(payloadForOpenOrder);
            // console.log('Open Order string: ', stringOrder);
            await this.webview.executeJavaScript(stringOrder);
            const result: TEntryOrderOpenRes = await waitForOrder;
            if (result.code >= 400) throw new Error(`${payload.symbol}: ${result.message}`);

            console.log(
                `✅ Create Order ${payloadForOpenOrder.symbol} - ${payload.reduce_only ? "Close" : "Open"} ${Number(payload.size) >= 0 ? "long" : "short"}: `,
                result,
            );

            if (!result.data) return;
            const status = `Create Order - ${payload.reduce_only ? "Close" : "Open"} ${this.getOrderSide(result.data)}`;

            // nếu là lệnh đóng thì reset lại thời gian cursor
            if (payload.reduce_only) {
                // this.newCursorTimeSeconds();
            }

            toast.success(`✅ ${status}`, {
                description: <DescriptionOpenEntry symbol={result.data.contract} size={result.data.size} side={this.getOrderSide(result.data)} />,
            });

            return result.data;
        } catch (err: any) {
            const status = `Create Order - ${payload.reduce_only ? "Close" : "Open"} ${Number(payload.size) >= 0 ? "long" : "short"}`;
            console.error(`❌ ${status} ${payload.symbol}`, err);
            toast.error(`❌ ${status} ${payload.symbol}`, { description: err.message });
            // throw err;
        } finally {
            if (handler) this.webview.removeEventListener("ipc-message", handler);
        }
    }

    async closeEntry(payload: TPayloadClickOpenEntry, returnPercent?: number, reason?: string) {
        let handler: any;

        try {
            const selectorWrapperPositionBlocks = this.uiSelector?.find((item) => item.code === "wrapperPositionBlocks")?.selectorValue;
            const selectorbuttonTabPosition = this.uiSelector?.find((item) => item.code === "buttonTabPosition")?.selectorValue;
            if (!selectorWrapperPositionBlocks || !selectorbuttonTabPosition) {
                console.log(`Not found selector`, { selectorWrapperPositionBlocks, selectorbuttonTabPosition });
                return;
            }

            const waitForOrder = new Promise((resolve: (value: TRespnoseGate<any>) => void) => {
                handler = (event: any) => {
                    const chanel = event.channel;
                    const data = event.args?.[0];
                    if (chanel === "api-response" && data.url === "/apiw/v2/futures/usdt/orders") {
                        const dataFull: TRespnoseGate<any> = tryJSONparse(data.bodyPreview);
                        // this.webview.removeEventListener("ipc-message", handler);
                        resolve(dataFull);
                    }
                };
                this.webview.addEventListener("ipc-message", handler);
            });

            const payloadForCloseOrder: TCloseOrder = {
                symbol: payload.symbol,
                side: payload.side,
                selector: {
                    wrapperPositionBlocks: selectorWrapperPositionBlocks,
                    buttonTabPosition: selectorbuttonTabPosition,
                },
            };
            console.log("payloadForCloseOrder: ", payloadForCloseOrder);

            const stringOrder = closeOrder(payloadForCloseOrder);
            // console.log('Close Order string: ', stringOrder);
            await this.webview.executeJavaScript(stringOrder);
            const result = await waitForOrder;
            if (result.code >= 400) throw new Error(`${payload.symbol}: ${result.message}`);

            console.log(`✅ 🔴Close Order ${payload.symbol} - ${payload.side}`, result);

            if (!result.data) return;
            const status = `Close Postion`;
            toast.success(`✅ ${status}`, {
                description: (
                    <DescriptionCloseEntry
                        symbol={result.data.contract}
                        returnPercent={returnPercent}
                        reason={reason}
                        tp={this.configBot.settingUser.takeProfit}
                        sl={this.configBot.settingUser.stopLoss}
                    />
                ),
            });
        } catch (err: any) {
            console.error(`❌ 🔴Close Order failed: `, err.message);
            const status = `Close Postion`;
            toast.error(`❌ ${status} ${payload.symbol}`, { description: err.message });
            // throw err;
        } finally {
            if (handler) this.webview.removeEventListener("ipc-message", handler);
        }
    }

    async openFillWatcher2() {
        const myTrades = await Bot.getMyTrades(this.webview, this.cursorTimeSeconds);
        console.log("myTrades: ", myTrades);

        if (!myTrades) return;

        const openOrderFill = myTrades?.filter((myTrade) => {
            const isOpenOrderFill = myTrade.close_size === 0;
            const isMaker = myTrade.role === "Maker";
            const isWeb = myTrade.text === "web";
            return isOpenOrderFill && isMaker && isWeb;
        });

        const openOrderFillGroup = this.groupByOrderIdSumSize(openOrderFill);
        console.log(`openOrderFillGroup: `, openOrderFillGroup);

        // lọc ra các lệnh close đã mở
        const closedInOpenOrder = this.orderOpens.filter((or) => {
            return or.is_reduce_only;
        });

        console.log(`closedInOpenOrder: `, closedInOpenOrder);

        const listShouldClose = openOrderFillGroup.filter((item) => {
            const hasMatch = closedInOpenOrder.some((or) => {
                const isSameSymbol = or.contract === item.contract;

                const tickSize = this.configBot.contracts.get(item.contract.replace("/", "_"))?.order_price_round;
                if (!tickSize) return false;
                const sideFortpPrice = item.size >= 0 ? "long" : "short";
                const price = this.tpPrice(Number(item.price), this.settingUser.takeProfit / 100, sideFortpPrice, tickSize);
                const isSamePrice = or.price === price;

                const isSameSize = this.isOppositeSameAbs(or.size, item.size);
                return isSameSymbol && isSameSize && isSamePrice;
            });

            return !hasMatch;
        });

        listShouldClose.sort((a, b) => {
            return a.create_time - b.create_time;
        });

        if (listShouldClose.length === 0) {
            this.cursorTimeSeconds = Math.floor(Date.now() / 1000);
        }

        console.log("listShouldClose: ", listShouldClose);
        return listShouldClose;
    }

    async openFillWatcher() {
        const myTrades = await Bot.getMyTrades(this.webview, this.cursorTimeSeconds);
        if (!myTrades?.length) return [];

        // 1) lấy các open-fill (Maker + web)
        const openOrderFill = myTrades.filter((t) => t.close_size === 0 && t.role === "Maker" && t.text === "web");

        // 2) gộp theo order_id (cộng size, giữ field khác từ record đầu)
        const openOrderFillGroup = this.groupByOrderIdSumSize(openOrderFill);
        console.log("openOrderFillGroup:", openOrderFillGroup);

        // 3) bucket các lệnh close đang mở (reduce_only)
        const closedInOpenOrder = this.orderOpens.filter((or) => or.is_reduce_only);
        console.log("closedInOpenOrder:", closedInOpenOrder);

        // bucket theo contract: mỗi phần tử là {price, size}
        const closeBuckets = new Map<string, Array<{ price: string; size: number }>>();
        for (const or of closedInOpenOrder) {
            const arr = closeBuckets.get(or.contract) ?? [];
            arr.push({ price: String(or.price), size: Number(or.size) });
            closeBuckets.set(or.contract, arr);
        }

        // 4) sắp xếp open theo thời gian cũ -> mới để khớp ổn định
        const sorted = [...openOrderFillGroup].sort((a, b) => a.create_time - b.create_time);

        const listShouldClose: typeof openOrderFillGroup = [];
        let maxTs = this.cursorTimeSeconds;

        for (const item of sorted) {
            const contract = item.contract; // "AAA/USDT"
            const itemSize = Number(item.size); // >0 long, <0 short
            const bucket = closeBuckets.get(contract) || [];

            // nếu không tìm thấy tickSize -> coi như chưa có close tương ứng (push luôn)
            const tickSize = this.configBot.contracts.get(contract.replace("/", "_"))?.order_price_round;
            if (!tickSize) {
                listShouldClose.push(item);
                if (item.create_time > maxTs) maxTs = item.create_time;
                continue;
            }

            // tính giá TP mục tiêu (giữ đúng logic giá bạn đang dùng)
            const sideFortpPrice = itemSize >= 0 ? "long" : "short";
            const targetPrice = this.tpPrice(Number(item.price), this.settingUser.takeProfit / 100, sideFortpPrice, tickSize);

            // tìm 1 close trong bucket có: khác dấu & cùng |size| & cùng giá
            const idx = bucket.findIndex(
                (or) => or.size * itemSize < 0 && Math.abs(or.size) === Math.abs(itemSize) && String(or.price) === targetPrice,
            );

            if (idx >= 0) {
                // đã có close tương ứng -> tiêu thụ phần tử này khỏi bucket
                bucket.splice(idx, 1);
                // (không push vào listShouldClose)
            } else {
                // chưa có close tương ứng -> cần tạo close
                listShouldClose.push(item);
            }

            closeBuckets.set(contract, bucket);
            if (item.create_time > maxTs) maxTs = item.create_time;
        }

        // 5) cập nhật cursor:
        // - nếu KHÔNG còn thiếu -> tiến cursor đến maxTs của batch
        // - nếu CÒN thiếu -> giữ nguyên cursor để vòng sau không bỏ sót
        if (listShouldClose.length === 0) {
            // this.cursorTimeSeconds = Math.max(this.cursorTimeSeconds, maxTs);
            this.cursorTimeSeconds = Math.floor(Date.now() / 1000);
        }

        console.log("listShouldClose:", listShouldClose);
        return listShouldClose;
    }

    getCloseOrderPayloads(): TPayloadClickOpenPostOnlyEntry[] {
        const payloads: TPayloadClickOpenPostOnlyEntry[] = [];

        for (const [, pos] of this.positions) {
            const remain = this.getRemainingToClose(pos);
            if (remain <= 0) continue; // đã đủ cover

            const side = this.getCloseSideForPos(pos);
            const sizeSigned = side === "long" ? +remain : -remain;

            const contractSlash = pos.contract; // "PI/USDT"
            const contract = contractSlash.replace("/", "_"); // "PI_USDT"

            const tickSize = this.configBot.contracts.get(contract)?.order_price_round;
            if (!tickSize) continue;

            // tính TP theo phía của POSITION (long -> +%, short -> -%)
            const entry_price = Number(pos.entry_price);
            const takeProfit = this.configBot.settingUser.takeProfit;
            const sideFortpPrice = this.getPosSide(pos);

            const price = this.tpPrice(entry_price, takeProfit / 100, sideFortpPrice, tickSize);

            payloads.push({
                symbol: contract,
                size: String(sizeSigned),
                price,
                reduce_only: true, // true là lệnh close
            });
        }

        return payloads;
    }

    isOppositeSameAbs = (a: number | string, b: number | string) => {
        const x = Number(a),
            y = Number(b);
        return x !== 0 && y !== 0 && x * y < 0 && Math.abs(x) === Math.abs(y);
    };

    newCursorTimeSeconds() {
        this.cursorTimeSeconds = Math.floor(Date.now() / 1000);
    }

    groupByOrderIdSumSize(trades: TMyTrade[]): TMyTrade[] {
        const map = new Map<string, TMyTrade>();
        for (const t of trades) {
            const prev = map.get(t.order_id);
            if (!prev) {
                map.set(t.order_id, { ...t });
            } else {
                prev.size += t.size;
            }
        }
        return Array.from(map.values());
    }

    ladderPrices(side: TSide, book: Book, layers: number, startTicks = 1): string[] {
        const { bidBest, askBest, order_price_round: tick } = book;
        const dec = this.decimalsFromTick(tick);
        if (startTicks < 1) startTicks = 1;

        // long: thấp hơn bid; short: cao hơn ask
        const base = side === "long" ? bidBest - startTicks * tick : askBest + startTicks * tick;

        const out: number[] = [];
        for (let i = 0; i < layers; i++) {
            const p =
                side === "long"
                    ? base - i * tick // mỗi bước = 1 tick
                    : base + i * tick;
            out.push(p);
        }
        return out.map((n) => n.toFixed(dec));
    }

    async handleRoi() {
        for (const [, pos] of this.positions) {
            const symbol = pos.contract.replace("/", "_");
            const size = pos.size;
            const entryPrice = Number(pos.entry_price);
            const leverage = Number(pos.leverage);
            const mode = pos.mode;
            const quanto_multiplier = this.configBot.contracts.get(symbol)?.quanto_multiplier;
            const lastPrice = this.symbolForClosePosition?.[symbol]?.lastPrice;
            const nowMs = Date.now(); // = now ở đơn vị ms

            console.log({
                size,
                entryPrice,
                quanto_multiplier,
                leverage,
                mode,
                lastPrice,
                nowMs,
                pos,
            });

            if (!size) continue;
            if (!entryPrice) continue;
            if (!quanto_multiplier) continue;
            if (!leverage) continue;
            if (!mode) continue;
            if (!lastPrice) continue;

            const initialMargin = (entryPrice * Math.abs(size) * quanto_multiplier) / leverage;
            const unrealizedPnL = (lastPrice - entryPrice) * size * quanto_multiplier;
            const returnPercent = (unrealizedPnL / initialMargin) * 100;

            const stopLoss = this.configBot.settingUser.stopLoss;
            const timeoutEnabled = this.configBot.settingUser.timeoutEnabled;
            const timeoutMs = this.configBot.settingUser.timeoutMs;
            const takeProfit = this.configBot.settingUser.takeProfit;
            const createdAtMs = this.toMs(pos.open_time);

            const isSL = returnPercent <= -stopLoss;
            const timedOut = timeoutEnabled && nowMs - createdAtMs >= timeoutMs;

            console.log(`[${symbol}] ${returnPercent} |${takeProfit} | ${stopLoss} | ${timedOut} | ${isSL}`);

            if (!isSL && !timedOut) continue; // ✅ Không thỏa mãn điều kiện nào

            const reason = isSL ? "🔴Loss" : `⏰Timeout - ${timeoutMs}`;

            const payload: TPayloadClickOpenEntry = {
                symbol: symbol,
                side: this.getPosSide(pos),
            };
            await this.withTimeout(this.closeEntry(payload, returnPercent, reason), 10_000, `Roi: closeEntry(open ${symbol})`);
        }
    }

    toMs(t: number | string) {
        const n = typeof t === "string" ? Number(t) : t;
        if (n < 1e12) return n * 1000; // seconds -> ms
        if (n > 1e14) return Math.floor(n / 1000); // microseconds -> ms (phòng hờ)
        return n; // đã là ms
    }

    clearPositions() {
        this.positions.clear();
    }

    private replacePositions(list: TPosition[]) {
        this.positions.clear();
        for (const p of list) this.setPosition(p);
    }

    isCheckwhitelistEntry() {
        if (this.whitelistEntry.length <= 0) {
            console.log(`whitelistEntry rỗng => không xử lý whitelistEntry`, this.whitelistEntry.length);
            return false;
        }
        if (this.getLengthOrderInOrderOpensAndPosition() >= this.configBot.settingUser.maxTotalOpenPO) {
            console.log(`Đã đạt giới hạn maxTotalOpenPO >= không xử lý whitelistEntry`, {
                maxTotalOpenPO: this.configBot.settingUser.maxTotalOpenPO,
                lengthOrderInOrderOpensAndPosition: this.getLengthOrderInOrderOpensAndPosition(),
            });
            return false;
        }

        console.log(`Thoả điều kiện tiến hành xử lý từng item trong whitelistEntry`);
        return true;
    }

    getLengthOrderInOrderOpensAndPosition(): number {
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
        console.log(`lengthOrderInOrderOpensAndPosition: ${length}`);

        return length;
    }

    isOrderExitsByContract(contract: string): boolean {
        const isExitsOrderOpens = !!this.orderOpens.find((item) => item.contract === contract.replace("_", "/") && !item.is_reduce_only);
        // if (isExitsOrderOpens) console.log(`${contract} đã tồn tại trong orderOpens => bỏ qua | isExitsOrderOpens: ${isExitsOrderOpens}`);

        const isExitsPosition = this.positions.has(contract);
        // if (isExitsPosition) console.log(`${contract} tồn tại trong position => bỏ qua | isExitsPosition: ${isExitsPosition}`);

        const isExits = isExitsOrderOpens || isExitsPosition;

        return isExits;
    }

    setPosition(value: TPosition) {
        const marginMode = Number(value.leverage) === 0 ? "cross" : "isolated";
        const contract = value.contract.replace("/", "_");
        const side = value.size > 0 ? "long" : "short";
        const key = `${contract}-${marginMode}-${side}-${value.leverage}`;
        this.positions.set(contract, value);
    }

    setOrderOpens(orderOpens: TGetOrderOpenRes["data"]) {
        this.orderOpens = orderOpens || [];
    }

    getPosSide(pos: TPosition): TSide {
        if (pos.mode === "dual_long") return "long";
        if (pos.mode === "dual_short") return "short";
        return pos.size >= 0 ? "long" : "short"; // single mode fallback
    }

    setSettingUser(settingUser: TSettingUsers) {
        this.configBot.settingUser = settingUser;
    }

    setUiSelector(uiSelector: TUiSelector[]) {
        this.configBot.uiSelector = uiSelector;
    }

    setWhitelist(whiteList: TWhiteList) {
        this.whiteList = whiteList;
        this.setWhitelistEntry();
    }

    getWhitelist() {
        return this.whiteList;
    }

    getWhitelistEntry() {
        return this.whitelistEntry;
    }

    setWhitelistEntry() {
        const whiteListArr = Object.values(this.whiteList);
        if (whiteListArr.length === 0) return;
        this.whitelistEntry = [];
        for (const whitelistItem of Object.values(this.whiteList)) {
            const { core, contractInfo } = whitelistItem;
            const { askBest, askSumDepth, bidBest, bidSumDepth, imbalanceAskPercent, imbalanceBidPercent, lastPrice, spreadPercent, symbol } = core;
            if (
                !symbol ||
                spreadPercent == null ||
                spreadPercent == undefined ||
                bidSumDepth == null ||
                bidSumDepth == undefined ||
                askSumDepth == null ||
                askSumDepth == undefined ||
                lastPrice == null ||
                lastPrice == undefined ||
                imbalanceAskPercent == null ||
                imbalanceAskPercent == undefined ||
                imbalanceBidPercent == null ||
                imbalanceBidPercent == undefined ||
                lastPrice == null ||
                lastPrice == undefined
            ) {
                continue;
            }
            const { order_price_round } = contractInfo;

            if (!this.isSpreadPercent(spreadPercent)) {
                // console.log(`[${symbol}] spreadPercent: ${spreadPercent} < ${this.settingUser.minSpreadPercent}`);
                continue;
            }
            if (!this.isDepth(askSumDepth, bidSumDepth)) {
                // console.log(
                //     `[${symbol}] bidSumDepth: ${bidSumDepth} < ${this.settingUser.maxDepth} | askSumDepth: ${askSumDepth} < ${this.settingUser.maxDepth}`,
                // );
                continue;
            }

            const sizeStr = this.handleSize(whitelistItem);
            if (!Bot.checkSize(sizeStr)) {
                // console.log(`[${symbol}] sizeStr: ${sizeStr}`);
                continue;
            }

            const isLong = imbalanceBidPercent > this.settingUser.ifImbalanceBidPercent;
            const isShort = imbalanceAskPercent > this.settingUser.ifImbalanceAskPercent;

            const side = this.pickSideByPriority(isLong, isShort, this.calPriority() as TPriority);
            if (!side) {
                // console.log(`[${symbol}] side: ${side}`);
                continue;
            }

            this.whitelistEntry.push({
                symbol,
                sizeStr: sizeStr,
                side,
                askBest,
                bidBest,
                order_price_round,
            });
        }
    }

    /**
     * hàm này sẽ được tính toán ở entry
     * quét SymbolState và tính size cho từng settingUser
     */
    handleSize(whitelistItem: TWhiteListItem): string {
        const { order_size_min, order_size_max, quanto_multiplier, symbol } = whitelistItem.contractInfo;
        const { lastPrice } = whitelistItem.core;
        const inputUSDT = this.settingUser.inputUSDT;
        if ([order_size_min, order_size_max, quanto_multiplier, inputUSDT, lastPrice].some((v) => v === null || v === undefined)) {
            console.log(`${symbol} - Tham số không hợp lệ: `, { order_size_min, order_size_max, quanto_multiplier, inputUSDT, lastPrice });
            return "0";
        }

        if (lastPrice === null || lastPrice === undefined || isNaN(lastPrice)) {
            console.log(`${symbol} - Giá không hợp lệ: `, lastPrice);
            return "0";
        } // Giá không hợp lệ

        const size = this.calcSize(inputUSDT, lastPrice, quanto_multiplier, order_size_min, order_size_max, order_size_min);

        if (size == null || isNaN(size)) {
            console.log(`${symbol} - Size không hợp lệ: `, size);
            return "0";
        }

        return size.toString();
    }

    calcSize(inputUSDT: number, price: number, multiplier: number, minSize = 1, maxSize?: number, step = 1) {
        if (!(price > 0) || !(multiplier > 0)) return 0;
        let size = Math.floor(inputUSDT / price / multiplier / step) * step;
        // size = Math.max(size, minSize);
        if (size < minSize) return 0;
        if (maxSize != null) size = Math.min(size, maxSize);
        return size;
    }

    /**
     * Spread từ 0.05% đến 0.20%
     */
    isSpreadPercent(spreadPercent: number): boolean {
        const minSpreadPercent = this.settingUser.minSpreadPercent;
        const maxSpreadPercent = this.settingUser.maxSpreadPercent;
        if (!spreadPercent) return false;
        const result = spreadPercent >= minSpreadPercent && spreadPercent <= maxSpreadPercent; // Spread 0.05% – 0.20%
        return result;
    }

    isDepth(askSumDepth: number, bidSumDepth: number): boolean {
        return bidSumDepth >= this.settingUser.maxDepth || askSumDepth >= this.settingUser.maxDepth;
    }

    setPriority24hChange(priority24hChange: TPayload24Change) {
        this.configBot.priority24hChange = priority24hChange;
    }

    setSymbolsForClosePosition(symbolForClosePosition: TSymbols) {
        this.symbolForClosePosition = symbolForClosePosition;
    }

    getOrderSide(o: TOrderOpen): TSide {
        return o.size >= 0 ? "long" : "short";
    }

    /** Hướng position -> hướng lệnh close */
    getCloseSideForPos(pos: TPosition): TSide {
        return this.getPosSide(pos) === "long" ? "short" : "long";
    }

    getCloseOrderPayloadsByPosition(): TPayloadClickOpenPostOnlyEntry[] {
        const payloads: TPayloadClickOpenPostOnlyEntry[] = [];

        for (const [, pos] of this.positions) {
            const remain = this.getRemainingToClose(pos);
            if (remain <= 0) continue; // đã đủ cover

            const side = this.getCloseSideForPos(pos);
            const sizeSigned = side === "long" ? +remain : -remain;

            const contractSlash = pos.contract; // "PI/USDT"
            const contract = contractSlash.replace("/", "_"); // "PI_USDT"

            const tickSize = this.configBot.contracts.get(contract)?.order_price_round;
            if (!tickSize) continue;

            // tính TP theo phía của POSITION (long -> +%, short -> -%)
            const entry_price = Number(pos.entry_price);
            const takeProfit = this.configBot.settingUser.takeProfit;
            const sideFortpPrice = this.getPosSide(pos);
            const price = this.tpPrice(entry_price, takeProfit / 100, sideFortpPrice, tickSize);

            payloads.push({
                symbol: contract,
                size: String(sizeSigned),
                price,
                reduce_only: true, // true là lệnh close
            });
        }

        return payloads;
    }

    getCloseOrderPayloadsByMyTrade(orderOpenFilled: TMyTrade[]): TPayloadClickOpenPostOnlyEntry[] {
        const payloads: TPayloadClickOpenPostOnlyEntry[] = [];

        for (const openFilled of orderOpenFilled) {
            payloads.push({
                symbol: openFilled.contract,
                size: String(openFilled.size),
                price: openFilled.price,
                reduce_only: true, // true là lệnh close
            });
        }

        return payloads;
    }

    /** Có phải là lệnh close tương ứng với position không? (đã đúng contract + đúng phía) */
    isCloseOrderForPosition(pos: TPosition, ord: TOrderOpen): boolean {
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

    /** tổng khối lượng lệnh close (reduce-only) còn treo cho position */
    private getCloseCoverage(pos: TPosition): number {
        return this.orderOpens
            .filter((o) => this.isCloseOrderForPosition(pos, o))
            .reduce((sum, o) => {
                const remain = Math.abs((o as any).left ?? o.size); // ưu tiên 'left' nếu có
                return sum + remain;
            }, 0);
    }

    /** số lượng còn thiếu để đóng hết position */
    private getRemainingToClose(pos: TPosition): number {
        const need = Math.abs(pos.size);
        const covered = this.getCloseCoverage(pos);
        const remain = need - covered;
        return remain > 0 ? remain : 0;
    }

    getPositionsNeedingClose(): Array<{ key: string; position: TPosition }> {
        const result: Array<{ key: string; position: TPosition }> = [];

        for (const [key, pos] of this.positions) {
            // kiểm tra từng position có lệnh close hay chưa
            // lặp từng position và so sách với tất cả order,
            // some: tất cả trả về false (hasClose = false) là chưa có lệnh close = push
            // some: trong lúc lặp mà true thì (hasClose = true) => không push
            const hasClose = this.orderOpens.some((ord) => this.isCloseOrderForPosition(pos, ord));
            if (!hasClose) {
                result.push({ key, position: pos });
            }
        }

        return result;
    }

    decimalsFromTick(tick: number) {
        const s = String(tick);
        if (s.includes("e-")) return Number(s.split("e-")[1]);
        const i = s.indexOf(".");
        return i >= 0 ? s.length - i - 1 : 0;
    }

    tpPrice(entry: number, tpPercent: number, side: TSide, tick: number, mark?: number): string {
        const dec = this.decimalsFromTick(tick);
        const ceilTick = (p: number) => Math.ceil(p / tick) * tick;
        const floorTick = (p: number) => Math.floor(p / tick) * tick;

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

    classify(orderOpen: TOrderOpen) {
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

    pickSideByPriority(isLong: boolean, isShort: boolean, priority: TPriority): TSide | null {
        switch (priority) {
            case "long":
                // console.log(`ưu tiên long, isLong: ${isLong}`);
                return isLong ? "long" : null;
            case "short":
                // console.log(`ưu tiên short, isShort: ${isShort}`);
                return isShort ? "short" : null;
            case "normal":
                // Giữ hành vi cũ: nếu cả 2 true thì ưu tiên long
                if (isLong && !isShort) {
                    // console.log(`normal => vào long`);
                    return "long";
                }
                if (!isLong && isShort) {
                    // console.log(`normal => vào short`);
                    return "short";
                }
                if (isLong && isShort) {
                    // console.log(`normal => vào long | isLong: ${isLong} | isShort: ${isShort}`);
                    return "long";
                }
                return null; // cả 2 false -> bỏ

            default:
                return null;
        }
    }

    calPriority() {
        const total = this.configBot.priority24hChange.countTotalWhiteList;
        const green = this.configBot.priority24hChange.countGreen;
        const red = this.configBot.priority24hChange.countRed;
        const thresholdLong = this.configBot.settingUser.max24hChangeGreen;
        const thresholdShort = this.configBot.settingUser.max24hChangeRed;

        const g = total ? Math.round((green / total) * 100) : 0;
        const r = total ? Math.round((red / total) * 100) : 0;
        // const n = Math.max(0, 100 - g - r);

        const priority = g >= thresholdLong ? ("long" as const) : r >= thresholdShort ? ("short" as const) : ("normal" as const);

        return priority;
    }

    set uiSelector(uiSelector: TUiSelector[]) {
        this.configBot.uiSelector = uiSelector;
    }
    get uiSelector(): TUiSelector[] {
        return this.configBot.uiSelector;
    }

    set settingUser(settingUser: TSettingUsers) {
        this.configBot.settingUser = settingUser;
    }
    get settingUser(): TSettingUsers {
        return this.configBot.settingUser;
    }

    private log(step: string, data?: any) {
        const ts = new Date().toISOString();
        if (data !== undefined) console.log(`[Bot][${ts}] ${step}`, data);
        else console.log(`[Bot][${ts}] ${step}`);
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

    /** Tóm tắt nhanh trạng thái để log gọn */
    private snapshot() {
        const openOpens = this.orderOpens.filter((o) => !o.is_reduce_only).length;
        const closeOpens = this.orderOpens.filter((o) => o.is_reduce_only).length;
        return {
            count: this.count,
            positions: this.positions,
            orderOpens: this.orderOpens,
            positionsSize: this.positions.size,
            orderOpens_open: openOpens,
            orderOpens_close: closeOpens,
            whitelistEntry: this.whitelistEntry,
            whitelistEntryLeng: this.whitelistEntry?.length ?? 0,
            // whitelist: this.whiteList,
            configBot: {
                settingUser: this.configBot.settingUser,
                // contracts: this.configBot.contracts,
                priority24hChange: this.configBot.priority24hChange,
                uiSelector: this.configBot.uiSelector,
            },
        };
    }
}

// Position: long hoặc short.

// Order để CLOSE:

// đóng long ⇒ SELL (tức short nếu bạn quy đổi về long/short).

// đóng short ⇒ BUY (tức long nếu bạn quy đổi về long/short).
