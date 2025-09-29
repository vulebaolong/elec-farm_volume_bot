import { Badge, Code, Divider, Group, Paper, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

// ==== TYPES (giữ nguyên như bạn đã định nghĩa) ====
import { MartingaleSummary } from "@/types/martingale.type";
import type { TWorkerData } from "@/types/worker.type";

// ==== Helper: format ====
function formatUnixSecToTime(sec?: number) {
    if (!sec || sec <= 0) return "—";
    const d = new Date(sec * 1000);
    return d.toLocaleTimeString();
}
function formatNumber(n?: number | string | null) {
    if (n === null || n === undefined) return "—";
    const v = Number(n);
    if (!Number.isFinite(v)) return String(n);
    // giữ gọn: không dùng locale để tránh reflow lớn
    return v.toString();
}

export default function Martingale() {
    const [summary, setSummary] = useState<MartingaleSummary>({
        status: "idle",
        targetContract: null,
        step: null,
        liquidationFinishTime: null,

        openFixContract: null,
        openFixPrice: null,
        inputUSDTFix: null,
        openFixCreateTime: null,

        tpContract: null,
        tpPrice: null,
        tpCreateTime: null,

        updatedAt: Date.now(),
    });

    useEffect(() => {
        const off = window.electron.ipcRenderer.on("bot:martingale", (msg: TWorkerData<MartingaleSummary>) => {
            console.log("bot:martingale", msg);
            setSummary(msg.payload);
        });
        return () => off?.();
    }, []);

    const headerBadge = useMemo(() => {
        if (summary.status === "fixing") {
            return (
                <Badge color="red" variant="light">
                    ĐANG FIX
                </Badge>
            );
        }
        return (
            <Badge color="gray" variant="light">
                RẢNH
            </Badge>
        );
    }, [summary.status]);

    return (
        <Paper withBorder radius="md" p="sm">
            <Group justify="space-between" align="center" mb="xs">
                <Group gap="xs">
                    <Text size="sm" fw={600}>
                        Martingale
                    </Text>
                    {headerBadge}
                </Group>
                <Text size="xs" c="dimmed">
                    cập nhật: {new Date(summary.updatedAt).toLocaleTimeString()}
                </Text>
            </Group>

            <Divider my={6} />

            {/* Hàng 1: Target (contract bị thanh lý) + Step */}
            <Group gap="md" wrap="wrap" mb={6}>
                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        Target
                    </Text>
                    <Code fz="xs">{summary.targetContract ?? "—"}</Code>
                </Group>

                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        Step
                    </Text>
                    <Code fz="xs">{summary.step != null ? summary.step : "—"}</Code>
                </Group>

                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        Liq time
                    </Text>
                    <Code fz="xs">{formatUnixSecToTime(summary.liquidationFinishTime ?? undefined)}</Code>
                </Group>
            </Group>

            {/* Hàng 2: Lệnh FIX đang mở */}
            <Group gap="md" wrap="wrap" mb={6}>
                <Text size="xs" fw={600}>
                    Lệnh Fix
                </Text>
                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        Contract
                    </Text>
                    <Code fz="xs">{summary.openFixContract ?? "—"}</Code>
                </Group>
                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        Price
                    </Text>
                    <Code fz="xs">{summary.openFixPrice ?? "—"}</Code>
                </Group>
                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        inputUSDT
                    </Text>
                    <Code fz="xs">{formatNumber(summary.inputUSDTFix)}</Code>
                </Group>
                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        CreatedAt
                    </Text>
                    <Code fz="xs">{formatUnixSecToTime(summary.openFixCreateTime ?? undefined)}</Code>
                </Group>
            </Group>

            {/* Hàng 3: Lệnh TP của Fix */}
            <Group gap="md" wrap="wrap">
                <Text size="xs" fw={600}>
                    TP của Fix
                </Text>
                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        contract
                    </Text>
                    <Code fz="xs">{summary.tpContract ?? "—"}</Code>
                </Group>
                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        Price
                    </Text>
                    <Code fz="xs">{summary.tpPrice ?? "—"}</Code>
                </Group>
                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        Size
                    </Text>
                    <Code fz="xs">{summary.tpSize ?? "—"}</Code>
                </Group>
                <Group gap={6}>
                    <Text size="xs" c="dimmed">
                        CreatedAt
                    </Text>
                    <Code fz="xs">{formatUnixSecToTime(summary.tpCreateTime ?? undefined)}</Code>
                </Group>
            </Group>
        </Paper>
    );
}
