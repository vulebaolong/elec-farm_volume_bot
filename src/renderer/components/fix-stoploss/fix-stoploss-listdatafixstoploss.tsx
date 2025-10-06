import { useUpsertFixStopLossQueue } from "@/api/tanstack/fix-stoploss-queue.tanstack";
import { TDataFixStopLoss } from "@/types/fix-stoploss.type";
import { TPosition } from "@/types/position.type";
import { TWorkerData } from "@/types/worker.type";
import { Badge, Group, Paper, Text } from "@mantine/core";
import { useLayoutEffect, useState } from "react";

type TProps = {
    fixStopLossQueueInit: TDataFixStopLoss["fixStopLossQueue"];
};

export default function FixStoplossListdatafixstoploss({ fixStopLossQueueInit }: TProps) {
    const upsertFixStopLossQueue = useUpsertFixStopLossQueue();
    const [fixStopLossQueue, setFixStopLossQueue] = useState(fixStopLossQueueInit);

    useLayoutEffect(() => {
        const offListDataFixStopLoss = window.electron.ipcRenderer.on("bot:upsertFixStopLossQueue", (data: TWorkerData<TPosition[]>) => {
            setFixStopLossQueue(data.payload);
            upsertFixStopLossQueue.mutate({ queue: data.payload });
        });
        return () => {
            offListDataFixStopLoss();
        };
    }, []);

    return (
        <div className="overflow-y-auto p-2 grid gap-2">
            {fixStopLossQueue.map((item, i) => {
                return (
                    <Paper key={i} withBorder radius="md" p="sm">
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
                    </Paper>
                );
            })}
        </div>
    );
}
