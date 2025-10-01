import { useGetTakeProfitAccount } from "@/api/tanstack/takeprofit-account.tanstack";
import { TTakeprofitAccount } from "@/types/takeprofit-account.type";
import { ActionIcon, Badge, Group, Loader, Paper, Table, Text } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function toNumber(value: string | number | null | undefined): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
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
    const [page, setPageIndex] = useState(1);
    const pageSize = 10;
    const totalPageRef = useRef(0);

    const getTakeProfitAccount = useGetTakeProfitAccount({
        pagination: { page, pageSize },
        filters: {},
        sort: { sortBy: "createdAt", isDesc: true },
    });

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
            const isProfit = item.pnl > 0;
            const isLoss = item.pnl < 0;

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
                            {fmtAmount(item.pnl, 6)}
                        </Text>
                    </Table.Td>
                    <Table.Td>
                        <Text size="sm" c={isProfit ? "green.6" : isLoss ? "red.6" : "gray.7"}>
                            {fmtPct(item.roi)}
                        </Text>
                    </Table.Td>
                </Table.Tr>
            );
        });
    }, [getTakeProfitAccount.data?.items]);

    return (
        <Paper radius="md" withBorder p="md">
            <Group justify="space-between" align="center" mb="sm">
                <Text fw={600}>Take Profit Account</Text>

                <Group gap="xs">
                    <ActionIcon
                        variant="subtle"
                        onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || getTakeProfitAccount.isFetching}
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={16} />
                    </ActionIcon>
                    <Text size="xs" c="dimmed">
                        {page} / {Math.max(1, totalPageRef.current)}
                    </Text>
                    <ActionIcon
                        variant="subtle"
                        onClick={() => setPageIndex((p) => (totalPageRef.current > 0 ? Math.min(totalPageRef.current, p + 1) : p + 1))}
                        disabled={getTakeProfitAccount.isFetching || (totalPageRef.current > 0 && page >= totalPageRef.current)}
                        aria-label="Next page"
                    >
                        <ChevronRight size={16} />
                    </ActionIcon>
                    {getTakeProfitAccount.isLoading ? <Loader size="xs" /> : null}
                </Group>
            </Group>

            <Table highlightOnHover stickyHeader withColumnBorders verticalSpacing="xs" horizontalSpacing="md">
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
