"use client";

import {
    useClearAllWhiteListIoc,
    useCreateWhiteListIoc,
    useGetWhiteListIoc,
    useRemoveWhiteListIoc,
    useResetWhiteLiseSocket,
} from "@/api/tanstack/white-list-ioc.tanstack";
import { TWhiteListIoc } from "@/types/white-list-ioc.type";
import { ActionIcon, Badge, Button, Card, Divider, Group, Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import ListContract from "../list-symbol-gate/list-symbol-gate";

export default function WhitelistIoc() {
    const [page, setPage] = useState(1);
    const pageSize = 99999;
    const getWhiteListIoc = useGetWhiteListIoc({
        pagination: { page, pageSize },
        filters: {},
        sort: { sortBy: "createdAt", isDesc: true },
    });
    const createWhiteListIoc = useCreateWhiteListIoc();
    const removeWhiteListIoc = useRemoveWhiteListIoc();
    const clearAllWhiteListIoc = useClearAllWhiteListIoc();
    const resetWhiteListSocket = useResetWhiteLiseSocket();

    const [whiteListIoc, setWhiteListIoc] = useState<TWhiteListIoc[]>([]);

    useEffect(() => {
        if (!getWhiteListIoc.data) return;
        setWhiteListIoc(getWhiteListIoc.data.items);
    }, [getWhiteListIoc.data]);

    const add = (symbol: string) => createWhiteListIoc.mutate({ symbol });
    const remove = (symbol: string) => removeWhiteListIoc.mutate({ symbol });
    const clearAll = () => clearAllWhiteListIoc.mutate();
    const reset = () => resetWhiteListSocket.mutate();

    return (
        <Stack gap={"xs"} className="w-full">
            <Title order={5} c="dimmed">
                WhiteList Ioc ({whiteListIoc.length})
            </Title>

            {/* Search & Add Section */}
            <ListContract onAdd={add} listIgnore={getWhiteListIoc.data?.items} />

            {/* Main Whitelist Card */}
            <Card withBorder radius="md" shadow="xs" p="sm" h={250}>
                <Group mb="xs">
                    <Group gap={"xs"}>
                        <Text fw={600} size="sm">
                            Danh sách WhiteList Ioc
                        </Text>
                        <Badge color="gray" variant="light">
                            {whiteListIoc.length}
                        </Badge>
                    </Group>

                    <Button
                        size="xs"
                        color="blue"
                        variant="light"
                        leftSection={<IconTrash size={14} />}
                        onClick={reset}
                        loading={resetWhiteListSocket.isPending}
                    >
                        Reload WL Socket
                    </Button>

                    <Button
                        size="xs"
                        color="red"
                        variant="light"
                        leftSection={<IconTrash size={14} />}
                        onClick={clearAll}
                        disabled={whiteListIoc.length === 0}
                    >
                        Clear all
                    </Button>
                </Group>

                <Divider mb="xs" />

                <ScrollArea offsetScrollbars>
                    {whiteListIoc.length === 0 ? (
                        <Text size="xs" c="dimmed" ta="center" py="sm">
                            Nodata
                        </Text>
                    ) : (
                        <Group gap={"sm"}>
                            {whiteListIoc.map((item) => (
                                <Paper key={item.id} radius="md" withBorder className="px-2 py-1">
                                    <Group>
                                        <Text fw={600} size="xs">
                                            {item.symbol}
                                        </Text>

                                        <ActionIcon variant="subtle" color="red" size="sm" radius="xl" onClick={() => remove(item.symbol)}>
                                            <IconX size={14} />
                                        </ActionIcon>
                                    </Group>
                                </Paper>
                            ))}
                        </Group>
                    )}
                </ScrollArea>
            </Card>
        </Stack>
    );
}
