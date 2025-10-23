import { Box, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

type SideCountItem = {
    keyPrevSidesCount: string;
    longHits: number;
    shortHits: number;
};

type WorkerMsg = {
    type: "bot:ioc:sideCount";
    payload: { sideCountItem: SideCountItem[]; tauS: number; stepS: number };
    uid: number;
};

function symbolFromKey(key: string) {
    const parts = key.split(":");
    return parts[parts.length - 1] || key;
}

type SegmentBarProps = {
    filledSteps: number;
    totalSteps: number;
    filledColorVar: string; // ví dụ: "var(--mantine-color-green-7)"
    backgroundColorVar: string; // ví dụ: "var(--mantine-color-gray-7)"
    segmentHeight?: number; // px
    segmentRadiusPx?: number; // px
    gapPx?: number; // px
};

function SegmentBar({
    filledSteps,
    totalSteps,
    filledColorVar,
    backgroundColorVar,
    segmentHeight = 10,
    segmentRadiusPx = 6,
    gapPx = 4,
}: SegmentBarProps) {
    const safeTotal = Math.max(1, Math.floor(totalSteps));
    const safeFilled = Math.min(Math.max(0, Math.floor(filledSteps)), safeTotal);

    return (
        <Group gap={gapPx} wrap="nowrap">
            {Array.from({ length: safeTotal }).map((_, index) => {
                const isFilled = index < safeFilled;
                return (
                    <Box
                        key={index}
                        style={{
                            height: segmentHeight,
                            borderRadius: segmentRadiusPx,
                            backgroundColor: isFilled ? filledColorVar : backgroundColorVar,
                            flex: 1,
                        }}
                    />
                );
            })}
        </Group>
    );
}

export default function SideCountIocMantine() {
    const [rowsByKey, setRowsByKey] = useState<Record<string, SideCountItem>>({});
    const [numberOfSteps, setNumberOfSteps] = useState(1);

    useEffect(() => {
        const off = window.electron.ipcRenderer.on("bot:ioc:sideCount", (msg: WorkerMsg) => {
            setNumberOfSteps(msg.payload.stepS || 1);
            setRowsByKey((prev) => {
                const next = { ...prev };
                for (const item of msg.payload.sideCountItem || []) {
                    next[item.keyPrevSidesCount] = item;
                }
                return next;
            });
        });
        return () => off?.();
    }, []);

    const items = useMemo(() => Object.values(rowsByKey), [rowsByKey]);

    if (items.length === 0) {
        return (
            <Paper withBorder p="md" radius="md">
                <Text c="dimmed" size="sm">
                    No data
                </Text>
            </Paper>
        );
    }

    return (
        <Paper withBorder p="md" radius="md">
            <ScrollArea.Autosize mah={320}>
                <Stack gap="sm">
                    {items.map((item) => {
                        const symbol = symbolFromKey(item.keyPrevSidesCount);

                        const longHitSteps = Math.min(Math.max(0, item.longHits | 0), numberOfSteps);
                        const shortHitSteps = Math.min(Math.max(0, item.shortHits | 0), numberOfSteps);

                        return (
                            <Group key={item.keyPrevSidesCount} gap="md" align="center" maw={300}  wrap="nowrap">
                                {/* Symbol bên trái */}
                                <Box w={150}>
                                    <Text size="sm" fw={600} ff="monospace">
                                        {symbol}
                                    </Text>
                                </Box>

                                {/* Hai thanh xếp chồng bên phải */}
                                <Stack gap={2} style={{ width: "100%" }}>
                                    {/* Thanh trên: Long (xanh đậm) */}
                                    <SegmentBar
                                        filledSteps={longHitSteps}
                                        totalSteps={numberOfSteps}
                                        filledColorVar="var(--mantine-color-green-7)"
                                        backgroundColorVar="var(--mantine-color-gray-7)"
                                        segmentHeight={5}
                                        segmentRadiusPx={8}
                                        gapPx={2}
                                    />
                                    {/* Thanh dưới: Short (đỏ đậm) */}
                                    <SegmentBar
                                        filledSteps={shortHitSteps}
                                        totalSteps={numberOfSteps}
                                        filledColorVar="var(--mantine-color-red-7)"
                                        backgroundColorVar="var(--mantine-color-gray-7)"
                                        segmentHeight={5}
                                        segmentRadiusPx={8}
                                        gapPx={2}
                                    />
                                </Stack>
                            </Group>
                        );
                    })}
                </Stack>
            </ScrollArea.Autosize>
        </Paper>
    );
}
