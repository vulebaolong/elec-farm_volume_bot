import { Paper, Stack, Group, Text, Divider, ScrollArea } from "@mantine/core";
import { useEffect, useState } from "react";
import type { TFixStoplossIoc } from "@/types/fix-stoploss-ioc.type";
import type { TWorkerData } from "@/types/worker.type";
import { formatLocalTime } from "@/helpers/function.helper";

export default function StoplossIoc() {
    const [items, setItems] = useState<TFixStoplossIoc[]>([]);

    useEffect(() => {
        const off = window.electron.ipcRenderer.on("bot:ioc:fixStopLossIOC", (msg: TWorkerData<TFixStoplossIoc[]>) => {
            setItems(Array.isArray(msg.payload) ? msg.payload : []);
        });
        return () => off?.();
    }, []);

    return (
        <Paper withBorder radius="md" p="md">
            <ScrollArea.Autosize mah={320}>
                <Stack gap="xs">
                    {items.length === 0 && (
                        <Text c="dimmed" size="sm">
                            Nodata
                        </Text>
                    )}

                    {items.map((item, idx) => (
                        <div key={`${item.symbol}-${item.createAt}-${idx}`}>
                            <Group gap={2}>
                                <Text size="sm" fw={600} ff="monospace">
                                    {item.symbol}
                                </Text>
                                <Text size="xs">{String(item.unrealizedPnL)}</Text>
                                <Text size="xs">{formatLocalTime(item.createAt, "HH:mm:ss")}</Text>
                            </Group>
                            {idx < items.length - 1 && <Divider mt="xs" />}
                        </div>
                    ))}
                </Stack>
            </ScrollArea.Autosize>
        </Paper>
    );
}
