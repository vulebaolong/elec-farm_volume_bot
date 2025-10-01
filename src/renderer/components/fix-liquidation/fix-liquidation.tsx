import { useGetFixLiquidation, useUpsertFixLiquidation } from "@/api/tanstack/fix-liquidation.tanstack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TUpsertFixLiquidationReq } from "@/types/fix-liquidation.type";
import { TWorkerData } from "@/types/worker.type";
import { ActionIcon, Group, Pagination, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FixLiquidationItem from "./fix-liquidation-item";

export default function FixLiquidation() {
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const upsertFixLiquidation = useUpsertFixLiquidation();

    const getFixLiquidation = useGetFixLiquidation({
        pagination: { page, pageSize },
        filters: {},
        sort: { sortBy: "createdAt", isDesc: true },
    });

    useEffect(() => {
        const offFixLiquidation = window.electron.ipcRenderer.on("bot:upsertFixLiquidation", (data: TWorkerData<TUpsertFixLiquidationReq>) => {
            upsertFixLiquidation.mutate(data.payload);
        });
        return () => offFixLiquidation?.();
    }, [upsertFixLiquidation]);

    const isLoading = getFixLiquidation.isLoading;
    const isError = getFixLiquidation.isError;
    const data = getFixLiquidation.data;

    const content = useMemo(() => {
        if (isLoading) {
            return (
                <Stack gap="xs">
                    {Array.from({ length: 1 }).map((_, i) => (
                        <Paper key={i} withBorder radius="md" p="sm">
                            <Skeleton height={14} mb={8} />
                            <Skeleton height={10} mt={6} />
                            <Skeleton height={10} mt={6} />
                        </Paper>
                    ))}
                </Stack>
            );
        }
        if (isError) {
            return (
                <Paper withBorder radius="md" p="sm">
                    <Group justify="space-between">
                        <Text fz={12} fw={600} c="red">
                            Load failed
                        </Text>
                        <ActionIcon size="sm" variant="subtle" onClick={() => getFixLiquidation.refetch()}>
                            <RefreshCcw size={14} />
                        </ActionIcon>
                    </Group>
                    <Text fz={11} c="dimmed">
                        Please try again.
                    </Text>
                </Paper>
            );
        }
        if (!data || !data.items?.length) {
            return (
                <Paper withBorder radius="md" p="sm">
                    <Text fz={12} c="dimmed">
                        No data.
                    </Text>
                </Paper>
            );
        }
        return (
            <Stack gap="xs">
                {data.items.map((item) => (
                    <FixLiquidationItem key={item.id} item={item} />
                ))}
            </Stack>
        );
    }, [isLoading, isError, data, getFixLiquidation]);

    return (
        <Card>
            <CardHeader className="flex items-center gap-2">
                <Group align="center">
                    <CardTitle className="text-base">Fix Liquidation</CardTitle>

                    <ActionIcon size="sm" variant="subtle" onClick={() => getFixLiquidation.refetch()} title="Refresh">
                        <RefreshCcw size={14} />
                    </ActionIcon>
                </Group>
            </CardHeader>

            <CardContent className="grid gap-2">
                <Stack gap="xs">
                    <div className="max-h-[300px] overflow-y-auto">{content}</div>

                    <Group align="center" mt="xs">
                        <Pagination size="xs" value={page} onChange={setPage} total={data?.totalPage ?? 1} boundaries={1} siblings={1} />
                        <Text fz={11} c="dimmed">
                            Page {data?.page ?? page} / {data?.totalPage ?? 1} • {data?.totalItem ?? 0} items
                        </Text>
                    </Group>
                </Stack>
            </CardContent>
        </Card>
    );
}
