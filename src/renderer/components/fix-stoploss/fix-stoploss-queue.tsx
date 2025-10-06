import { useGetFixStopLossQueueByUserId, useUpsertFixStopLossQueue } from "@/api/tanstack/fix-stoploss-queue.tanstack";
import { TDataStopLossShouldFix } from "@/types/fix-stoploss.type";
import { TPosition } from "@/types/position.type";
import { TWorkerData } from "@/types/worker.type";
import { ActionIcon, Badge, Group, Paper, Text } from "@mantine/core";
import { X } from "lucide-react";
import { useLayoutEffect } from "react";

type TProps = {};

export default function FixStoplossQueue({}: TProps) {
    const upsertFixStopLossQueue = useUpsertFixStopLossQueue();
    const getFixStopLossQueueByUserId = useGetFixStopLossQueueByUserId();

    useLayoutEffect(() => {
        const offFixStopLossQueue = window.electron.ipcRenderer.on("bot:upsertFixStopLossQueue", (data: TWorkerData<TDataStopLossShouldFix[]>) => {
            upsertFixStopLossQueue.mutate({ queue: data.payload });
        });
        return () => {
            offFixStopLossQueue();
        };
    }, []);

    const removeQueue = (item: TDataStopLossShouldFix) => {
        window.electron?.ipcRenderer.sendMessage("bot:removeFixStopLossQueue", item);
    };

    return (
        <div className="max-h-[300px] overflow-y-auto p-2 grid gap-2">
            {(getFixStopLossQueueByUserId.data?.queue || []).map((item, i) => {
                return (
                    <Paper key={i} withBorder radius="md" p="sm">
                        <Group w={"100%"} justify="space-between">
                            <Group align="center" gap={10} wrap="nowrap">
                                <Badge variant="light" size="xs">
                                    #{i}
                                </Badge>

                                <div className="flex flex-col leading-tight min-w-0">
                                    <Group gap={6} align="center" wrap="nowrap" className="min-w-0">
                                        <Text fz={12} fw={600} className="truncate">
                                            {item.contract}
                                        </Text>
                                    </Group>
                                </div>
                            </Group>

                            <ActionIcon size="sm" variant="subtle" onClick={() => removeQueue(item)} title="remove">
                                <X size={14} />
                            </ActionIcon>
                        </Group>
                    </Paper>
                );
            })}
        </div>
    );
}
