import DescriptionCloseEntry from "@/components/description-entry/description-close-entry";
import DescriptionOpenEntry from "@/components/description-entry/description-open-entry";
import { changeLeverageHandler } from "@/helpers/change-leverage-handler.helper";
import { buildLadderOpenOrders, checkSize, computePostOnlyPrice, tryJSONparse } from "@/helpers/function.helper";
import {
    closeOrder,
    createCodeStringGetOrderOpens,
    createCodeStringGetPositions,
    openOrderPostOnly,
    TCloseOrder,
    TOpenOrderPostOnly,
} from "@/javascript-string/logic-farm";
import { TRespnoseGate, TSide } from "@/types/base.type";
import { TContract } from "@/types/contract.type";
import { TPayloadClickOpenEntry, TPayloadClickOpenPostOnlyEntry } from "@/types/entry.type";
import { TEntryOrderOpenRes, TGetOrderOpenRes, TOrderOpen } from "@/types/order.type";
import { TPosition, TPositionRes } from "@/types/position.type";
import { TPayload24Change, TPriority } from "@/types/priority-change.type";
import { TSettingUsers } from "@/types/setting-user.type";
import { SymbolState, TSymbols } from "@/types/symbol.type";
import { TUiSelector } from "@/types/ui-selector.type";
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

    private count = 0;
    private configBot: TBotConfig;
    private webview: Electron.WebviewTag;

    private positions = new Map<string, TPosition>();
    private orderOpens: TOrderOpen[];
    private symbolEntry: SymbolState[] = []; // chỉ chứa các symbol vào lệnh
    private symbolForClosePosition: TSymbols = {}; // chứa các symbol để có thông tin thoát lệnh, hiện tại đang cần lastPrice

    private isHandle: boolean = false;

    constructor(newBot: TNewBot) {
        // copy để tránh bị mutate từ bên ngoài
        this.configBot = { ...newBot.configBot };
        this.webview = newBot.webview;
        this.orderOpens = newBot.orderOpens || [];
        newBot.positions.forEach((position) => {
            this.setPosition(position);
        });
    }

    setIsHandle(isHandle: boolean) {
        this.isHandle = isHandle;
    }

    async start() {
        console.log(12123123);
        while (true) {
            console.log({
                count: this.count,
                positions: this.positions,
                orderOpens: this.orderOpens,
                symbolEntry: this.symbolEntry,
                configBot: this.configBot,
            });

            if (this.isHandle) {
                console.log("Kiểm tra position: để vào lệnh close");
                if (this.positions.size > 0) {
                    const payloads = this.getCloseOrderPayloads(); // 1 bước: tính + build payload

                    for (const p of payloads) {
                        console.log("Đặt close order:", p);
                        await this.openEntry(p);
                        // refresh để lần lặp sau không đặt trùng
                        this.setOrderOpens(await Bot.getOrderOpens(this.webview));

                        (await Bot.getPositions(this.webview)).forEach((position) => {
                            this.setPosition(position);
                        });
                    }
                }

                console.log("Kiểm tra symbolEntry: để vào lệnh open");
                if (this.isCheckSymbolEntry()) {
                    for (const item of this.symbolEntry) {
                        const { symbol, flags } = item;

                        // nếu symbol đó đã tồn tại trong orderOpens -> bỏ qua
                        if (this.isOrderExitsByContract(symbol)) continue;
                        console.log(`1. Symbol: ${symbol} chưa tồn tại trong orderOpens: tiếp`);

                        const spec = flags?.entryBySettingUserId?.[this.configBot.settingUser.id];
                        if (!spec) {
                            console.log(`Can't find spec for ${symbol}`);
                            continue;
                        }
                        console.log(`2. Có spec: tiếp`);

                        const { size, isLong, isShort } = spec;

                        // Ưu tiên/lọc theo priority
                        const side = this.pickSideByPriority(isLong, isShort, this.calPriority() as TPriority);
                        if (!side) {
                            // không phù hợp priority -> bỏ
                            continue;
                        }
                        console.log(`3. Có side: ${side} tiếp`);

                        if (!checkSize(size)) {
                            toast.error(`Size: ${size} is not valid`);
                            continue;
                        }
                        console.log(`4. Có Size: ${size} tiếp`);

                        // Đổi leverage trước khi vào lệnh
                        const ok = await changeLeverageHandler({
                            symbol,
                            leverageNumber: this.configBot.settingUser.leverage,
                            webview: this.webview,
                        });
                        if (!ok) continue;
                        console.log(`5. Đã đổi leverage: ${this.configBot.settingUser.leverage} tiếp`);

                        const orders = buildLadderOpenOrders(
                            side, // "long" hoặc "short"
                            {
                                bidBest: item.bidBest,
                                askBest: item.askBest,
                                orderPriceRound: item.orderPriceRound,
                            },
                            5, // 5 lớp
                            1, // cách nhau 1 tick
                            3,
                        );

                        console.log(orders);
                        // const priceStr = computePostOnlyPrice(side, item, index);

                        for (const p of orders) {
                            const payloadOpenOrder: TPayloadClickOpenPostOnlyEntry = {
                                symbol,
                                size: side === "long" ? size : `-${size}`,
                                price: p.price,
                                reduce_only: false, // false là lệnh open
                            };
                            await this.openEntry(payloadOpenOrder);
                        }
                        // refresh để lần lặp sau không đặt trùng
                        this.setOrderOpens(await Bot.getOrderOpens(this.webview));

                        (await Bot.getPositions(this.webview)).forEach((position) => {
                            this.setPosition(position);
                        });
                        console.log(`6. Đã vào lệnh order open`);
                    }
                }

                console.log("Kiểm tra position: để xử lý SL");
                if (this.positions.size > 0) {
                    await this.handleRoi();
                }
            }

            this.count += 1;
            await sleep(5000);
        }
    }

    async openEntry(payload: TPayloadClickOpenPostOnlyEntry) {
        try {
            const selectorInputPosition = this.uiSelector?.find((item) => item.code === "inputPosition")?.selectorValue;
            const selectorInputPrice = this.uiSelector?.find((item) => item.code === "inputPrice")?.selectorValue;
            const selectorButtonLong = this.uiSelector?.find((item) => item.code === "buttonLong")?.selectorValue;
            if (!selectorInputPosition || !selectorButtonLong || !selectorInputPrice) {
                console.log(`Not found selector`, { selectorInputPosition, selectorButtonLong, selectorInputPrice });
                throw new Error(`Not found selector`);
            }

            const waitForOrder = new Promise((resolve: (value: TRespnoseGate<any>) => void) => {
                const handler = (event: any) => {
                    const chanel = event.channel;
                    const data = event.args?.[0];
                    if (chanel === "api-response" && data.url === "/apiw/v2/futures/usdt/orders") {
                        const dataFull: TRespnoseGate<any> = tryJSONparse(data.bodyPreview);
                        this.webview.removeEventListener("ipc-message", handler);
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

            console.log("payloadForOpenOrder: ", payloadForOpenOrder);

            const stringOrder = openOrderPostOnly(payloadForOpenOrder);
            // console.log('Open Order string: ', stringOrder);
            await this.webview.executeJavaScript(stringOrder);
            const result: TEntryOrderOpenRes = await waitForOrder;
            if (result.code >= 400) throw new Error(`${payload.symbol}: ${result.message}`);

            console.log(`✅ 🟢Open Order ${payloadForOpenOrder.symbol} - ${payload.size} - `, result);

            if (!result.data) return;
            const status = `Open Order`;
            toast.success(`✅ ${status}`, {
                description: <DescriptionOpenEntry symbol={result.data.contract} size={result.data.size} side={this.getOrderSide(result.data)} />,
            });

            return result.data;
        } catch (err: any) {
            console.error("❌ 🟢Open Order failed: ", err);
            const status = `Open Order`;
            toast.error(`❌ ${status} ${payload.symbol}`, { description: err.message });
            // throw err;
        }
    }

    async closeEntry(payload: TPayloadClickOpenEntry, returnPercent?: number, reason?: string) {
        try {
            const selectorWrapperPositionBlocks = this.uiSelector?.find((item) => item.code === "wrapperPositionBlocks")?.selectorValue;
            const selectorbuttonTabPosition = this.uiSelector?.find((item) => item.code === "buttonTabPosition")?.selectorValue;
            if (!selectorWrapperPositionBlocks || !selectorbuttonTabPosition) {
                console.log(`Not found selector`, { selectorWrapperPositionBlocks, selectorbuttonTabPosition });
                return;
            }

            const waitForOrder = new Promise((resolve: (value: TRespnoseGate<any>) => void) => {
                const handler = (event: any) => {
                    const chanel = event.channel;
                    const data = event.args?.[0];
                    if (chanel === "api-response" && data.url === "/apiw/v2/futures/usdt/orders") {
                        const dataFull: TRespnoseGate<any> = tryJSONparse(data.bodyPreview);
                        this.webview.removeEventListener("ipc-message", handler);
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
        }
    }

    async handleRoi() {
        for (const [, pos] of this.positions) {
            const symbol = pos.contract.replace("/", "_");
            const size = pos.size;
            const entryPrice = Number(pos.entry_price);
            const quanto_multiplier = this.configBot.contracts.get(symbol)?.quanto_multiplier;
            const leverage = Number(pos.leverage);
            const mode = pos.mode;
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

            await this.closeEntry(payload, returnPercent, reason);
            // refresh để lần lặp sau không đặt trùng
            this.setOrderOpens(await Bot.getOrderOpens(this.webview));

            (await Bot.getPositions(this.webview)).forEach((position) => {
                this.setPosition(position);
            });
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

    isCheckSymbolEntry() {
        if (this.symbolEntry.length <= 0) {
            console.log(`symbolEntry rỗng => không xử lý symbolEntry`, this.symbolEntry.length);
            return false;
        }
        if (this.getLengthOrderInOrderOpensAndPosition() >= this.configBot.settingUser.maxTotalOpenPO) {
            console.log(`Đã đạt giới hạn maxTotalOpenPO >= không xử lý symbolEntry`, {
                maxTotalOpenPO: this.configBot.settingUser.maxTotalOpenPO,
                lengthOrderInOrderOpensAndPosition: this.getLengthOrderInOrderOpensAndPosition(),
            });
            return false;
        }

        console.log(`Thoả điều kiện tiến hành xử lý từng item trong symbolEntry`);
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

        return length
    }

    isOrderExitsByContract(contractDraw: string): boolean {
        const contract = contractDraw.replace("_", "/");
        const isExitsOrderOpens = !!this.orderOpens.find((item) => item.contract === contract && !item.is_reduce_only);
        if (isExitsOrderOpens) console.log(`${contractDraw} đã tồn tại trong orderOpens => bỏ qua | isExitsOrderOpens: ${isExitsOrderOpens}`);

        const isExitsPosition = this.positions.has(contract);
        if (isExitsPosition) console.log(`${contractDraw} tồn tại trong position => bỏ qua | isExitsPosition: ${isExitsPosition}`);

        const isExits = isExitsOrderOpens || isExitsPosition;

        return isExits;
    }

    setPosition(value: TPosition) {
        const marginMode = Number(value.leverage) === 0 ? "cross" : "isolated";
        const contract = value.contract.replace("/", "_");
        const side = value.size > 0 ? "long" : "short";
        const key = `${contract}-${marginMode}-${side}-${value.leverage}`;
        this.positions.set(key, value);
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

    setSymbolEntry(symbolEntry: SymbolState[]) {
        this.symbolEntry = symbolEntry;
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

    tpPrice(entry: number, tpPercent: number, side: TSide, tick: number): string {
        const factor = side === "long" ? 1 + tpPercent : 1 - tpPercent;
        const raw = entry * factor;
        const dec = this.decimalsFromTick(tick);
        const rounded = Math.round(raw / tick) * tick;
        return rounded.toFixed(dec); // trả về chuỗi đúng tick
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
                console.log(`ưu tiên long, isLong: ${isLong}`);
                return isLong ? "long" : null;
            case "short":
                console.log(`ưu tiên short, isShort: ${isShort}`);
                return isShort ? "short" : null;
            case "normal":
                // Giữ hành vi cũ: nếu cả 2 true thì ưu tiên long
                if (isLong && !isShort) {
                    console.log(`normal => vào long`);
                    return "long";
                }
                if (!isLong && isShort) {
                    console.log(`normal => vào short`);
                    return "short";
                }
                if (isLong && isShort) {
                    console.log(`normal => vào long | isLong: ${isLong} | isShort: ${isShort}`);
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
}

// Position: long hoặc short.

// Order để CLOSE:

// đóng long ⇒ SELL (tức short nếu bạn quy đổi về long/short).

// đóng short ⇒ BUY (tức long nếu bạn quy đổi về long/short).
