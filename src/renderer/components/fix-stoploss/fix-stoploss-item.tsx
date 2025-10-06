import { formatLocalTime } from "@/helpers/function.helper";
import { TFixStopLossInDB } from "@/types/fix-stoploss.type";
import { Accordion, Badge, Divider, Group, Paper, Stack, Text } from "@mantine/core";
import { Fragment } from "react/jsx-runtime";
import FixStopLossRow from "./fix-stoploss-row";
import FixStopLossStatus from "./fix-stoploss-status";

function firstNonEmptyPrice(...values: (string | number | undefined)[]): string {
    for (const v of values) {
        if (v === undefined || v === null) continue;
        const s = typeof v === "string" ? v : String(v);
        if (s.trim() !== "" && s !== "0") return s;
    }
    return "-";
}

type TProps = {
    item: TFixStopLossInDB;
};

export default function FixStopLossItem({ item }: TProps) {
    const isDone = !!item?.isDone;
    const fixPayload = item?.data;

    // Target (đang xử lý)
    const targetContract = fixPayload?.dataStopLossShouldFix?.contract ?? "Idle";
    const targetStep = fixPayload?.stepFixStopLoss ?? 0;
    const targetInputUSDT = fixPayload?.inputUSDTFix ?? "-";
    const targetLeverage = fixPayload?.leverageFix ?? "-";
    // const targetLiqTime = fixPayload?.dataStopLossShouldFix?.open_time ? formatLocalTime(fixPayload.dataStopLossShouldFix.open_time) : "-";

    // Order “Fix” hiện tại
    const currentFixOrder = fixPayload?.dataOrderOpenFixStopLoss;
    const currentFixContract = currentFixOrder?.contract ?? "-";
    const currentFixPrice = firstNonEmptyPrice(currentFixOrder?.price, currentFixOrder?.fill_price);
    const currentFixCreatedAt = currentFixOrder?.create_time ? formatLocalTime(currentFixOrder.create_time) : "-";

    // Order “TP Fix” hiện tại
    const currentTpOrder = fixPayload?.dataCloseTP;
    const currentTpContract = currentTpOrder?.contract ?? "-";
    const currentTpPrice = firstNonEmptyPrice(currentTpOrder?.price, currentTpOrder?.fill_price);
    const currentTpCreatedAt = currentTpOrder?.create_time ? formatLocalTime(currentTpOrder.create_time) : "-";

    const histories = item.FixStopLossHistories ?? [];

    return (
        <Accordion variant="separated" chevronPosition="right">
            <Accordion.Item value={`fix-stoploss-${item.id}`}>
                {/* HEADER: click để mở/đóng */}
                <Accordion.Control>
                    <Group align="center" gap={10} wrap="nowrap">
                        <Badge variant="light" size="xs">
                            #{item.id}
                        </Badge>

                        <Group gap={6} align="center" wrap="nowrap" className="min-w-0 flex-1">
                            <Text fz={12} fw={600} className="truncate">
                                {targetContract}
                            </Text>
                            <FixStopLossStatus item={item} />
                        </Group>
                    </Group>
                </Accordion.Control>

                {/* PANEL: Target (trên cùng, nền khác) + History */}
                <Accordion.Panel>
                    <Stack gap="xs">
                        {/* Target block – nổi bật nhẹ */}
                        <Paper withBorder radius="md" p="sm" className="bg-[var(--mantine-color-gray-0)] dark:bg-[var(--mantine-color-dark-6)]">
                            <Text fz={11} fw={700} mb={6}>
                                Target
                            </Text>

                            {/* Thông tin Target */}
                            <Group gap={10} wrap="wrap" className="flex-1">
                                {[
                                    ["Step", targetStep + 1],
                                    ["Input", targetInputUSDT],
                                    ["Leverage", targetLeverage],
                                ].map(([label, value]) => (
                                    <Group key={String(label)} gap={6}>
                                        <Text fz={11} c="dimmed">
                                            {label}:
                                        </Text>
                                        <Text fz={11} fw={500}>
                                            {String(value)}
                                        </Text>
                                    </Group>
                                ))}
                            </Group>

                            {/* Fix / TP Fix của Target hiện tại */}
                            <Stack gap={4} mt={6}>
                                <FixStopLossRow
                                    label="Fix"
                                    items={[
                                        ["Contract", currentFixContract],
                                        ["Price", currentFixPrice],
                                        ["CreatedAt", currentFixCreatedAt],
                                    ]}
                                />
                                <FixStopLossRow
                                    label="TP Fix"
                                    items={[
                                        ["Contract", currentTpContract],
                                        ["Price", currentTpPrice],
                                        ["CreatedAt", currentTpCreatedAt],
                                    ]}
                                />
                            </Stack>
                        </Paper>

                        {/* History */}
                        {histories.length > 0 ? (
                            <Stack gap="xs">
                                <Divider my={2} />
                                {histories.map((historyItem) => {
                                    const historyFix = historyItem.data?.dataOrderOpenFixStopLoss;
                                    const historyTp = historyItem.data?.dataCloseTP;

                                    const historyFixContract = historyFix?.contract ?? "-";
                                    const historyFixPrice = firstNonEmptyPrice(historyFix?.price, historyFix?.fill_price);
                                    const historyFixCreatedAt = historyFix?.create_time ? formatLocalTime(historyFix.create_time) : "-";

                                    const historyTpContract = historyTp?.contract ?? "-";
                                    const historyTpPrice = firstNonEmptyPrice(historyTp?.price, historyTp?.fill_price);
                                    const historyTpCreatedAt = historyTp?.create_time ? formatLocalTime(historyTp.create_time) : "-";

                                    const historyStep = historyItem.data?.stepFixStopLoss ?? 0;
                                    const historyInputUSDT = historyItem.data?.inputUSDTFix ?? "-";
                                    const historyLeverage = historyItem.data?.leverageFix ?? "-";

                                    return (
                                        <Fragment key={historyItem.id}>
                                            <Paper withBorder radius="md" p="sm">
                                                <Group gap={10} wrap="wrap" className="flex-1" mb={6}>
                                                    {[
                                                        ["Step", historyStep + 1],
                                                        ["Input", historyInputUSDT],
                                                        ["Leverage", historyLeverage],
                                                    ].map(([label, value]) => (
                                                        <Group key={String(label)} gap={6}>
                                                            <Text fz={11} c="dimmed">
                                                                {label}:
                                                            </Text>
                                                            <Text fz={11} fw={500}>
                                                                {String(value)}
                                                            </Text>
                                                        </Group>
                                                    ))}
                                                </Group>

                                                <Stack gap={4}>
                                                    <FixStopLossRow
                                                        label="Fix"
                                                        items={[
                                                            ["Contract", historyFixContract],
                                                            ["Price", historyFixPrice],
                                                            ["CreatedAt", historyFixCreatedAt],
                                                        ]}
                                                    />
                                                    <FixStopLossRow
                                                        label="TP Fix"
                                                        items={[
                                                            ["Contract", historyTpContract],
                                                            ["Price", historyTpPrice],
                                                            ["CreatedAt", historyTpCreatedAt],
                                                        ]}
                                                    />
                                                </Stack>
                                            </Paper>
                                        </Fragment>
                                    );
                                })}
                            </Stack>
                        ) : (
                            <Text fz={11} c="dimmed">
                                No history yet.
                            </Text>
                        )}
                    </Stack>
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>
    );
}
