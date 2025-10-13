"use client";

import {
    useClearAllWhiteListScalpIoc,
    useCreateWhiteListScalpIoc,
    useGetWhiteListScalpIoc,
    useRemoveWhiteListScalpIoc,
    useUpdateWhiteListScalpIoc,
} from "@/api/tanstack/white-list-scalp-ioc.tanstack";
import { TWhiteListScalpIoc } from "@/types/white-list-scalp-ioc.type";
import { ActionIcon, Badge, Button, Card, Divider, Group, Input, Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import WhitelistIOCSymbol from "../white-list-ioc/white-list-ioc-symbol";

export default function WhitelistScalpIoc() {
    const [page, setPage] = useState(1);
    const pageSize = 99999;
    const getWhiteListScalpIoc = useGetWhiteListScalpIoc({
        pagination: { page, pageSize },
        filters: {},
        sort: { sortBy: "createdAt", isDesc: true },
    });
    const createWhiteListScalpIoc = useCreateWhiteListScalpIoc();
    const removeWhiteListScalpIoc = useRemoveWhiteListScalpIoc();
    const clearAllWhiteListScalpIoc = useClearAllWhiteListScalpIoc();
    const updateSize = useUpdateWhiteListScalpIoc();

    const [whiteListScalpIoc, setWhiteListScalpIoc] = useState<TWhiteListScalpIoc[]>([]);

    useEffect(() => {
        if (!getWhiteListScalpIoc.data) return;
        setWhiteListScalpIoc(getWhiteListScalpIoc.data.items);
    }, [getWhiteListScalpIoc.data]);

    const add = (symbol: string) => createWhiteListScalpIoc.mutate({ symbol });
    const remove = (symbol: string) => removeWhiteListScalpIoc.mutate({ symbol });
    const clearAll = () => clearAllWhiteListScalpIoc.mutate();

    const handleUpdateSize = (e: React.FocusEvent<HTMLInputElement>, symbol: string) => {
        updateSize.mutate({ symbol, size: Number(e.target.value) });
    };

    const handleUpdateMaxSize = (e: React.FocusEvent<HTMLInputElement>, symbol: string) => {
        updateSize.mutate({ symbol, maxSize: Number(e.target.value) });
    };

    return (
        <Stack gap={"xs"} className="w-full">
            <Title order={5} c="dimmed">
                WhiteList Scalp Ioc ({whiteListScalpIoc.length})
            </Title>

            {/* Search & Add Section */}
            <WhitelistIOCSymbol onAdd={add} listIgnore={getWhiteListScalpIoc.data?.items} />

            {/* Main Whitelist Card */}
            <Card withBorder radius="md" shadow="xs" p="sm" h={250}>
                <Group mb="xs">
                    <Group gap={"xs"}>
                        <Text fw={600} size="sm">
                            Danh sách WhiteList ScalpIoc
                        </Text>
                        <Badge color="gray" variant="light">
                            {whiteListScalpIoc.length}
                        </Badge>
                    </Group>

                    <Button
                        size="xs"
                        color="red"
                        variant="light"
                        leftSection={<IconTrash size={14} />}
                        onClick={clearAll}
                        disabled={whiteListScalpIoc.length === 0}
                    >
                        Clear all
                    </Button>
                </Group>

                <Divider mb="xs" />

                <ScrollArea offsetScrollbars>
                    {whiteListScalpIoc.length === 0 ? (
                        <Text size="xs" c="dimmed" ta="center" py="sm">
                            Nodata
                        </Text>
                    ) : (
                        <Group gap={"sm"}>
                            {whiteListScalpIoc.map((item) => (
                                <Paper
                                    key={item.id}
                                    radius="md"
                                    withBorder
                                    className="px-2 py-1"
                                >
                                    <Group>
                                    <Group gap={"xs"}>
                                        <Text fw={600} size="xs" style={{ minWidth: 80 }}>
                                            {item.symbol}
                                        </Text>

                                        <Input
                                            placeholder="Size"
                                            size="xs"
                                            radius="sm"
                                            w={65}
                                            onBlur={(e) => handleUpdateSize(e, item.symbol)}
                                            defaultValue={item.size ?? ""}
                                        />

                                        <Input
                                            placeholder="Max"
                                            size="xs"
                                            radius="sm"
                                            w={65}
                                            onBlur={(e) => handleUpdateMaxSize(e, item.symbol)}
                                            defaultValue={item.maxSize ?? ""}
                                        />
                                    </Group>

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
