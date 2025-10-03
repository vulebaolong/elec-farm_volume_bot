import { useGetFixStopLoss, useUpsertFixStopLoss } from "@/api/tanstack/fix-stoploss.tanstack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TUpsertFixStopLossReq } from "@/types/fix-stoploss.type";
import { TWorkerData } from "@/types/worker.type";
import { ActionIcon, Badge, Group, Pagination, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FixStopLossItem from "./fix-stoploss-item";
import { cn } from "@/lib/utils";
import FixStoplossListdatafixstoploss from "./fix-stoploss-listdatafixstoploss";

export default function FixStopLoss() {
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const upsertStopLoss = useUpsertFixStopLoss();

    const getFixStopLoss = useGetFixStopLoss({
        pagination: { page, pageSize },
        filters: {},
        sort: { sortBy: "createdAt", isDesc: true },
    });

    useEffect(() => {
        const offFixStopLoss = window.electron.ipcRenderer.on("bot:upsertFixStopLoss", (data: TWorkerData<TUpsertFixStopLossReq>) => {
            upsertStopLoss.mutate(data.payload);
        });
        return () => offFixStopLoss?.();
    }, [upsertStopLoss]);

    const isLoading = getFixStopLoss.isLoading;
    const isError = getFixStopLoss.isError;
    const data = getFixStopLoss.data;

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
                        <ActionIcon size="sm" variant="subtle" onClick={() => getFixStopLoss.refetch()}>
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
                    <FixStopLossItem key={item.id} item={item} />
                ))}
            </Stack>
        );
    }, [isLoading, isError, data, getFixStopLoss]);

    return (
        <Card>
            <CardHeader className="flex items-center gap-2">
                <Group align="center">
                    <CardTitle className={cn("text-base")}>Fix Stoploss</CardTitle>

                    <ActionIcon size="sm" variant="subtle" onClick={() => getFixStopLoss.refetch()} title="Refresh">
                        <RefreshCcw size={14} />
                    </ActionIcon>
                </Group>
            </CardHeader>

            <CardContent className="flex gap-2">
                <Card className="p-0 flex-1">
                    <Stack gap="xs">
                        <div className="max-h-[300px] overflow-y-auto p-2">{content}</div>

                        <Group align="center" className="p-2 pt-0">
                            <Pagination size="xs" value={page} onChange={setPage} total={data?.totalPage ?? 1} boundaries={1} siblings={1} />
                            <Text fz={11} c="dimmed">
                                Page {data?.page ?? page} / {data?.totalPage ?? 1} • {data?.totalItem ?? 0} items
                            </Text>
                        </Group>
                    </Stack>
                </Card>
                <Card className="flex-1 p-0">
                    {getFixStopLoss.data?.items?.[0]?.data?.listDataFixStopLoss && (
                        <FixStoplossListdatafixstoploss listDataFixStopLossInit={getFixStopLoss.data?.items?.[0]?.data?.listDataFixStopLoss || []} />
                    )}
                </Card>
            </CardContent>
        </Card>
    );
}
