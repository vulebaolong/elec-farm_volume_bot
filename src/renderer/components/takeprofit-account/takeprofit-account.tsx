import { useGetTakeProfitAccount } from "@/api/tanstack/takeprofit-account.tanstack";
import { useEffect, useMemo, useRef, useState } from "react";
import { Paper, Table, Group, Text, Badge, ActionIcon, Loader } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TTakeprofitAccount = {
    id: number;
    userId: number;
    uid: number;
    source: string;
    phase: number;
    oldTotal: string;
    newTotal: string;
    createdAt: string;
    updatedAt: string;
    // ... các field khác nếu cần
};

function toNumber(value: string | number | null | undefined): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function calcPnlRoi(oldTotal: number, newTotal: number) {
    const pnl = newTotal - oldTotal;
    const roi = oldTotal > 0 ? (pnl / oldTotal) * 100 : 0;
    return { pnl, roi };
}

function fmtAmount(n: number, digits = 6) {
    return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function fmtPct(n: number) {
    const sign = n > 0 ? "+" : n < 0 ? "-" : "";
    const abs = Math.abs(n).toFixed(2);
    return `${sign}${abs}%`;
}

export default function TakeprofitAccount() {
    const [pageIndex, setPageIndex] = useState(1);
    const pageSize = 10;
    const totalPageRef = useRef(0);

    const getTakeProfitAccount = useGetTakeProfitAccount({
        pagination: { pageIndex, pageSize },
        filters: {},
        sort: { sortBy: "createdAt", isDesc: true },
    });

    console.log({ getTakeProfitAccount: getTakeProfitAccount.data });

    useEffect(() => {
        if (getTakeProfitAccount.data?.totalPage != null) {
            totalPageRef.current = getTakeProfitAccount.data.totalPage;
        }
    }, [getTakeProfitAccount.data?.totalPage]);

    const rows = useMemo(() => {
        const items: TTakeprofitAccount[] = getTakeProfitAccount.data?.items ?? [];
        return items.map((item) => {
            const oldN = toNumber(item.oldTotal);
            const newN = toNumber(item.newTotal);
            const { pnl, roi } = calcPnlRoi(oldN, newN);
            const isProfit = pnl > 0;
            const isLoss = pnl < 0;

            return (
                <Table.Tr key={item.id}>
                    <Table.Td>
                        <Group gap="xs" align="center">
                            <Badge variant="light" size="sm">
                                {item.phase}
                            </Badge>
                            <Badge variant="outline" size="sm">
                                {item.source}
                            </Badge>
                        </Group>
                    </Table.Td>
                    <Table.Td>
                        <Text size="xs" c="dimmed">
                            {new Date(item.createdAt).toLocaleString()}
                        </Text>
                    </Table.Td>
                    <Table.Td>
                        <Text size="sm">{fmtAmount(oldN)}</Text>
                    </Table.Td>
                    <Table.Td>
                        <Text size="sm">{fmtAmount(newN)}</Text>
                    </Table.Td>
                    <Table.Td>
                        <Text size="sm" c={isProfit ? "green.6" : isLoss ? "red.6" : "gray.7"}>
                            {fmtAmount(pnl, 6)}
                        </Text>
                    </Table.Td>
                    <Table.Td>
                        <Text size="sm" c={isProfit ? "green.6" : isLoss ? "red.6" : "gray.7"}>
                            {fmtPct(roi)}
                        </Text>
                    </Table.Td>
                </Table.Tr>
            );
        });
    }, [getTakeProfitAccount.data?.items]);

    // Tổng quát (optional): tính PnL & ROI trên toàn bảng đang hiển thị
    const summary = useMemo(() => {
        const items: TTakeprofitAccount[] = getTakeProfitAccount.data?.items ?? [];
        console.log({ items, getTakeProfitAccount: getTakeProfitAccount.data });
        if (items.length === 0) return null;

        const firstOld = toNumber(items[items.length - 1]?.oldTotal); // vì sort desc theo createdAt
        const lastNew = toNumber(items[0]?.newTotal);
        const { pnl, roi } = calcPnlRoi(firstOld, lastNew);
        return { pnl, roi };
    }, [getTakeProfitAccount.data?.items]);

    return (
        <Paper radius="md" withBorder p="md">
            <Group justify="space-between" align="center" mb="sm">
                <Text fw={600}>Take Profit Account</Text>

                <Group gap="xs">
                    <ActionIcon
                        variant="subtle"
                        onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                        disabled={pageIndex <= 1 || getTakeProfitAccount.isFetching}
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={16} />
                    </ActionIcon>
                    <Text size="xs" c="dimmed">
                        Page {pageIndex} / {Math.max(1, totalPageRef.current)}
                    </Text>
                    <ActionIcon
                        variant="subtle"
                        onClick={() => setPageIndex((p) => (totalPageRef.current > 0 ? Math.min(totalPageRef.current, p + 1) : p + 1))}
                        disabled={getTakeProfitAccount.isFetching || (totalPageRef.current > 0 && pageIndex >= totalPageRef.current)}
                        aria-label="Next page"
                    >
                        <ChevronRight size={16} />
                    </ActionIcon>
                    {getTakeProfitAccount.isFetching ? <Loader size="xs" /> : null}
                </Group>
            </Group>

            {summary && (
                <Group mb="sm" gap="lg">
                    <Group gap={6}>
                        <Text size="xs" c="dimmed">
                            Total PnL:
                        </Text>
                        <Text size="sm" c={summary.pnl > 0 ? "green.6" : summary.pnl < 0 ? "red.6" : "gray.7"}>
                            {fmtAmount(summary.pnl)}
                        </Text>
                    </Group>
                    <Group gap={6}>
                        <Text size="xs" c="dimmed">
                            Total ROI:
                        </Text>
                        <Text size="sm" c={summary.roi > 0 ? "green.6" : summary.roi < 0 ? "red.6" : "gray.7"}>
                            {fmtPct(summary.roi)}
                        </Text>
                    </Group>
                </Group>
            )}

            <Table highlightOnHover stickyHeader withTableBorder withColumnBorders verticalSpacing="xs" horizontalSpacing="md">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Phase</Table.Th>
                        <Table.Th>Time</Table.Th>
                        <Table.Th>Old total</Table.Th>
                        <Table.Th>New total</Table.Th>
                        <Table.Th>PnL</Table.Th>
                        <Table.Th>ROI</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {rows.length > 0 ? (
                        rows
                    ) : (
                        <Table.Tr>
                            <Table.Td colSpan={6}>
                                <Text size="sm" c="dimmed">
                                    {getTakeProfitAccount.isLoading ? "Loading..." : "No data"}
                                </Text>
                            </Table.Td>
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>

            <Text size="xs" c="dimmed" mt="xs">
                ROI = (New - Old) / Old x 100%
            </Text>
        </Paper>
    );
}
