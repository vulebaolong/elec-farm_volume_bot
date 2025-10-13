"use client";

import { useAppSelector } from "@/redux/store";
import { Card, Divider, Group, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { useMemo } from "react";

type TGateCore = {
    symbol: string;
    spreadPercent?: number;
    imbalanceBidPercent?: number;
    imbalanceAskPercent?: number;
    bidSumDepth?: number;
    askSumDepth?: number;
    bidBest?: number;
    askBest?: number;
    lastPrice?: number;
};

type TBinanceCore = {
    symbol: string;
    lastPrice?: number;
};

type TContractInfo = {
    symbol: string;
    order_price_round: number;
    quanto_multiplier: number;
};

type TItem = {
    contractInfo: TContractInfo;
    core: { gate: TGateCore; binance: TBinanceCore };
};

type TWhiteList = Record<string, TItem>;

const fmtPrice = (v?: number, step = 0.001) => {
    // tự động chọn số lẻ theo step
    const digits = Math.max(0, (step.toString().split(".")[1] || "").length);
    return typeof v === "number" && Number.isFinite(v)
        ? v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
        : "-";
};

const fmtPct = (v?: number, digits = 2) => (typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(digits)}%` : "-");

function ImbalanceBar({ bidPercent = 0, askPercent = 0 }: { bidPercent?: number; askPercent?: number }) {
    // chuẩn hoá để tổng = 100
    const total = (bidPercent ?? 0) + (askPercent ?? 0);
    const bid = total > 0 ? (bidPercent / total) * 100 : 0;
    const ask = total > 0 ? (askPercent / total) * 100 : 0;

    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    const bidClamped = clamp(bid);
    const askClamped = clamp(ask);

    return (
        <Progress.Root size="lg" radius="xl">
            <Progress.Section value={bidClamped} color="teal">
                {/* Bạn có thể hiện label trong bar nếu muốn */}
                <Progress.Label>{fmtPct(bidPercent)}</Progress.Label>
            </Progress.Section>
            <Progress.Section value={askClamped} color="red">
                <Progress.Label>{fmtPct(askPercent)}</Progress.Label>
            </Progress.Section>
        </Progress.Root>
    );
}

export default function WhiteListDetail() {
    const whitelistDetail = useAppSelector((state) => state.bot.whitelistDetail) as TWhiteList | undefined;

    const entries = useMemo(() => Object.entries(whitelistDetail ?? {}), [whitelistDetail]);

    if (!entries.length) {
        return (
            <Card withBorder radius="lg" p="lg">
                <Text size="sm" c="dimmed">
                    Không có dữ liệu whitelist để hiển thị.
                </Text>
            </Card>
        );
    }

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {entries.map(([symbol, item]) => {
                const { contractInfo, core } = item;
                const gate = core?.gate ?? {};
                const binance = core?.binance ?? {};

                const step = contractInfo?.order_price_round ?? 0.001;

                return (
                    <Card key={symbol} withBorder radius="lg" p="md" shadow="xs">
                        {/* Prices row */}
                        <Stack gap="xs">
                            <Text size="xs" fw={"bold"}>
                                {symbol}
                            </Text>
                            <Text size="xs" c="dimmed">
                                Gate {fmtPrice(gate.lastPrice, step)}
                            </Text>

                            <Text size="xs" c="dimmed">
                                Binance {fmtPrice(binance.lastPrice, step)}
                            </Text>

                            <Text size="xs" c="dimmed">
                                Spread {fmtPct(gate.spreadPercent, 3)}
                            </Text>
                        </Stack>

                        <Divider my="sm" />

                        {/* Imbalance bar */}
                        <ImbalanceBar bidPercent={gate.imbalanceBidPercent} askPercent={gate.imbalanceAskPercent} />
                    </Card>
                );
            })}
        </SimpleGrid>
    );
}
