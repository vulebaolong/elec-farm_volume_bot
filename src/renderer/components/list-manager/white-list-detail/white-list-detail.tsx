"use client";

import { handleSideNew } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import type { TWhiteList } from "@/types/white-list.type";
import { Accordion, Badge, Box, Divider, Group, NumberFormatter, Progress, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { useMemo } from "react";

/* ---------- Imbalance Bar (Mantine v7) ---------- */
function ImbalanceBar({ bidPercent = 0, askPercent = 0 }: { bidPercent?: number; askPercent?: number }) {
    const total = (bidPercent ?? 0) + (askPercent ?? 0);
    const bid = total > 0 ? (bidPercent / total) * 100 : 0;
    const ask = total > 0 ? (askPercent / total) * 100 : 0;
    const clamp = (n: number) => Math.max(0, Math.min(100, n));

    return (
        <Group gap={0}>
            <Text size="xs" c="teal.7" w={70}>
                B <NumberFormatter value={bidPercent} decimalScale={2} suffix="%" />
            </Text>
            <Progress.Root size="md" radius="xl" flex={1}>
                <Progress.Section value={clamp(bid)} color="teal" />
                <Progress.Section value={clamp(ask)} color="red" />
            </Progress.Root>
            <Text size="xs" c="red.7" w={70} ta="right">
                <NumberFormatter value={askPercent} decimalScale={2} suffix="%" />
            </Text>
        </Group>
    );
}

/* ---------- Bảng orderbook: asks đỏ trên, bids xanh dưới ---------- */
type Level = { p: number | string; s: number };

export function OrderBook({ asks = [], bids = [], lastPrice, step }: { asks?: Level[]; bids?: Level[]; lastPrice?: number; step?: number }) {
    return (
        <Stack gap={6} w={200}>
            {/* Asks: giữ nguyên thứ tự như server trả */}
            <ScrollArea h={160} type="never">
                <Table stickyHeader withRowBorders={false} highlightOnHover={false} verticalSpacing={2} horizontalSpacing="xs">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>
                                <Text size="xs" c="red.7">
                                    Ask (Price)
                                </Text>
                            </Table.Th>
                            <Table.Th>
                                <Text size="xs" c="red.7" ta="right">
                                    Size
                                </Text>
                            </Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {asks.map((row, i) => (
                            <Table.Tr key={`ask-${i}`}>
                                <Table.Td>
                                    <Text size="xs" c="red.7">
                                        <NumberFormatter value={row.p} decimalScale={8} />
                                    </Text>
                                </Table.Td>
                                <Table.Td ta="right">
                                    <Text size="xs" c="red.7">
                                        <NumberFormatter value={row.s} decimalScale={0} />
                                    </Text>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </ScrollArea>

            <NumberFormatter value={lastPrice} thousandSeparator />

            {/* Bids: giữ nguyên thứ tự như server trả */}
            <ScrollArea h={160} type="never">
                <Table stickyHeader withRowBorders={false} highlightOnHover={false} verticalSpacing={2} horizontalSpacing="xs">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>
                                <Text size="xs" c="teal.7">
                                    Bid (Price)
                                </Text>
                            </Table.Th>
                            <Table.Th>
                                <Text size="xs" c="teal.7" ta="right">
                                    Size
                                </Text>
                            </Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {bids.map((row, i) => (
                            <Table.Tr key={`bid-${i}`}>
                                <Table.Td>
                                    <Text size="xs" c="teal.7">
                                        <NumberFormatter value={row.p} decimalScale={8} />
                                    </Text>
                                </Table.Td>
                                <Table.Td ta="right">
                                    <Text size="xs" c="teal.7">
                                        <NumberFormatter value={row.s} decimalScale={0} />
                                    </Text>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </Stack>
    );
}

/* ---------- Component chính ---------- */
export default function WhiteListDetailAccordion() {
    const whitelistDetail = useAppSelector((state) => state.bot.whitelistDetail) as TWhiteList | undefined;
    const entries = useMemo(() => Object.entries(whitelistDetail ?? {}), [whitelistDetail]);

    if (!entries.length)
        return (
            <Text size="sm" c="dimmed">
                Không có dữ liệu whitelist để hiển thị.
            </Text>
        );

    return (
        <div className="max-h-[544px] overflow-y-auto">
            <Accordion multiple={true} chevronPosition="left" radius="md" variant="separated">
                {entries.map(([symbol, item]) => {
                    const sideScalp = handleSideNew(item.core.gate.sScalp || 0);
                    const sideFarm = handleSideNew(item.core.gate.sFarm || 0);

                    return (
                        <Accordion.Item key={symbol} value={symbol}>
                            <Accordion.Control>
                                <Group justify="space-between" wrap="nowrap">
                                    <Text fw={700} size="sm">
                                        {symbol}
                                    </Text>
                                    <Group gap={6}>
                                        <Badge
                                            size="xs"
                                            color={sideFarm === null ? "gray" : sideFarm === "long" ? "green" : "red"}
                                            variant="light"
                                            tt="none"
                                        >
                                            Farm {sideFarm === null ? "hold" : sideFarm}
                                        </Badge>
                                        <Badge
                                            size="xs"
                                            color={sideScalp === null ? "gray" : sideScalp === "long" ? "green" : "red"}
                                            variant="light"
                                            tt="none"
                                        >
                                            Scalp {sideScalp === null ? "hold" : sideScalp}
                                        </Badge>
                                    </Group>
                                </Group>
                            </Accordion.Control>

                            <Accordion.Panel>
                                <Stack gap="xs">
                                    {/* infoOBI */}
                                    <Box>
                                        <Text size="xs" fw={600}>
                                            OBI
                                        </Text>

                                        <Group>
                                            <Stack gap={0}>
                                                <Text size="xs" c="dimmed">
                                                    total5Bid - total5Ask
                                                </Text>
                                                <Divider />
                                                <Text size="xs" c="dimmed">
                                                    total5Bid + total5Ask
                                                </Text>
                                            </Stack>

                                            <Stack gap={0}>
                                                <Text size="xs">
                                                    <NumberFormatter value={item.core.gate.infoOBI.tota5lBid} decimalScale={2} />
                                                    - <NumberFormatter value={item.core.gate.infoOBI.total5Ask} decimalScale={2} />
                                                </Text>
                                                <Divider />
                                                <Text size="xs">
                                                    <NumberFormatter value={item.core.gate.infoOBI.tota5lBid} decimalScale={2} />
                                                    + <NumberFormatter value={item.core.gate.infoOBI.total5Ask} decimalScale={2} />
                                                </Text>
                                            </Stack>

                                            <Text size="xs">
                                                ={" "}
                                                <Text span fw={600}>
                                                    <NumberFormatter value={item.core.gate.infoOBI.OBI} />
                                                </Text>
                                            </Text>
                                        </Group>
                                    </Box>

                                    {/* infoAgg */}
                                    <Box>
                                        <Text size="xs" fw={600}>
                                            AGG
                                        </Text>

                                        <Group>
                                            <Stack gap={0}>
                                                <Text size="xs" c="dimmed" ta={"center"}>
                                                    sumBid
                                                </Text>
                                                <Divider />
                                                <Text size="xs" c="dimmed">
                                                    sumBid + sumAsk
                                                </Text>
                                            </Stack>

                                            <Stack gap={0}>
                                                <Text size="xs" c="dimmed" ta={"center"}>
                                                    <NumberFormatter value={item.core.gate.infoAgg.sumBid} thousandSeparator />
                                                </Text>
                                                <Divider />
                                                <Text size="xs" c="dimmed">
                                                    <NumberFormatter value={item.core.gate.infoAgg.sumBid} thousandSeparator /> +
                                                    <NumberFormatter value={item.core.gate.infoAgg.sumAsk} thousandSeparator />
                                                </Text>
                                            </Stack>

                                            <Text span fw={600} size="xs">
                                                ={" "}
                                            </Text>

                                            <Stack gap={0}>
                                                <Group gap={2}>
                                                    <Text span fw={600} size="xs">
                                                        <NumberFormatter value={item.core.gate.infoAgg.agg || 0} />
                                                    </Text>
                                                    <Text span fw={600} size="xs">
                                                        [0,1]
                                                    </Text>
                                                </Group>
                                                <Group gap={2}>
                                                    <Text span fw={600} size="xs">
                                                        <NumberFormatter value={item.core.gate.infoAgg.AGG || 0} />
                                                    </Text>
                                                    <Text span fw={600} size="xs">
                                                        [-1,1]
                                                    </Text>
                                                </Group>
                                            </Stack>
                                        </Group>
                                    </Box>

                                    {/* infoTMM */}
                                    <Box>
                                        <Text size="xs" fw={600}>
                                            Tick Moment
                                        </Text>
                                        <Group>
                                            <Stack gap={0}>
                                                <Text size="xs" c="dimmed" ta={"center"}>
                                                    Total mid price
                                                </Text>
                                                <Divider />
                                                <Text size="xs" c="dimmed" ta={"center"}>
                                                    Total count
                                                </Text>
                                            </Stack>

                                            <Stack gap={0}>
                                                <Text size="xs" c="dimmed" ta={"center"}>
                                                    <NumberFormatter value={item.core.gate.infoTMM.mid || 0} decimalScale={2} />
                                                </Text>
                                                <Divider />
                                                <Text size="xs" c="dimmed" ta={"center"}>
                                                    <NumberFormatter value={item.core.gate.infoTMM.count || 0} decimalScale={2} />
                                                </Text>
                                            </Stack>

                                            <Text span fw={600} size="xs">
                                                ={" "}
                                            </Text>

                                            <Text span fw={600} size="xs">
                                                <NumberFormatter value={item.core.gate.infoTMM.TMM || 0} />
                                            </Text>
                                        </Group>
                                    </Box>

                                    {/* sScalp & sFarm */}
                                    <Group gap="md">
                                        <Box>
                                            <Text size="xs" fw={600}>
                                                Scalp
                                            </Text>
                                            <Text size="xs" c="dimmed">
                                                0.45 * AGG + 0.35 * Tick Moment + 0.2 * OBI
                                            </Text>
                                            <Group gap={2}>
                                                <Text size="xs" c="dimmed">
                                                    0.45 *
                                                </Text>
                                                <Text fw={600} size="xs">
                                                    <NumberFormatter value={item.core.gate.infoAgg.AGG || 0} />
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    + 0.35 *
                                                </Text>
                                                <Text fw={600} size="xs">
                                                    <NumberFormatter value={item.core.gate.infoTMM.TMM || 0} />
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    + 0.2 *
                                                </Text>
                                                <Text fw={600} size="xs">
                                                    <NumberFormatter value={item.core.gate.infoOBI.OBI || 0} />
                                                </Text>
                                            </Group>
                                            <Group gap={2}>
                                                <Text span fw={600} size="xs">
                                                    ={" "}
                                                </Text>
                                                <Text fw={600} size="xs">
                                                    <NumberFormatter value={item.core.gate.sScalp || 0} />
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    {sideScalp === null ? "#" : sideScalp === "long" ? ">" : "<"} 0.1
                                                </Text>
                                            </Group>
                                            <Badge
                                                size="xs"
                                                color={sideScalp === null ? "gray" : sideScalp === "long" ? "green" : "red"}
                                                variant="light"
                                                radius="xl"
                                            >
                                                {sideScalp === null ? "hold" : sideScalp}
                                            </Badge>
                                        </Box>
                                        <Box>
                                            <Text size="xs" fw={600}>
                                                Farm
                                            </Text>
                                            <Text size="xs" c="dimmed">
                                                0.55 * AGG + 0.3 * Tick Moment + 0.15 * OBI
                                            </Text>
                                            <Group gap={2}>
                                                <Text size="xs" c="dimmed">
                                                    0.55 *
                                                </Text>
                                                <Text fw={600} size="xs">
                                                    <NumberFormatter value={item.core.gate.infoAgg.AGG || 0} />
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    + 0.3 *
                                                </Text>
                                                <Text fw={600} size="xs">
                                                    <NumberFormatter value={item.core.gate.infoTMM.TMM || 0} />
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    + 0.15 *
                                                </Text>
                                                <Text fw={600} size="xs">
                                                    <NumberFormatter value={item.core.gate.infoOBI.OBI || 0} />
                                                </Text>
                                            </Group>
                                            <Group gap={2}>
                                                <Text span fw={600} size="xs">
                                                    ={" "}
                                                </Text>
                                                <Text fw={600} size="xs">
                                                    <NumberFormatter value={item.core.gate.sFarm || 0} />
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    {sideFarm === null ? "#" : sideFarm === "long" ? ">" : "<"} 0.1
                                                </Text>
                                            </Group>
                                            <Badge
                                                size="xs"
                                                color={sideFarm === null ? "gray" : sideFarm === "long" ? "green" : "red"}
                                                variant="light"
                                                radius="xl"
                                            >
                                                {sideFarm === null ? "hold" : sideFarm}
                                            </Badge>
                                        </Box>
                                    </Group>

                                    {/* OrderBook */}
                                    <OrderBook
                                        asks={item.core.gate.asks}
                                        bids={item.core.gate.bids}
                                        step={item.contractInfo.order_price_round}
                                        lastPrice={item.core.gate.lastPrice}
                                    />

                                    {/* Imbalance */}
                                    <ImbalanceBar bidPercent={item.core.gate.imbalanceBidPercent} askPercent={item.core.gate.imbalanceAskPercent} />
                                </Stack>
                            </Accordion.Panel>
                        </Accordion.Item>
                    );
                })}
            </Accordion>
        </div>
    );
}
