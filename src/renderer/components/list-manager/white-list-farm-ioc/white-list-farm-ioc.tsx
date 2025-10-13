"use client";

import {
    useClearAllWhiteListFarmIoc,
    useCreateWhiteListFarmIoc,
    useGetWhiteListFarmIoc,
    useRemoveWhiteListFarmIoc,
    useUpdateWhiteListFarmIoc,
} from "@/api/tanstack/white-list-farm-ioc.tanstack";
import { TWhiteListFarmIoc } from "@/types/white-list-farm-ioc.type";
import { ActionIcon, Badge, Button, Card, Divider, Group, Input, Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import ListContract from "../list-symbol-gate/list-symbol-gate";
import WhitelistIOCSymbol from "../white-list-ioc/white-list-ioc-symbol";

export default function WhitelistFarmIoc() {
    const [page, setPage] = useState(1);
    const pageSize = 99999;
    const getWhiteListFarmIoc = useGetWhiteListFarmIoc({
        pagination: { page, pageSize },
        filters: {},
        sort: { sortBy: "createdAt", isDesc: true },
    });
    const createWhiteListFarmIoc = useCreateWhiteListFarmIoc();
    const removeWhiteListFarmIoc = useRemoveWhiteListFarmIoc();
    const clearAllWhiteListFarmIoc = useClearAllWhiteListFarmIoc();
    const updateSize = useUpdateWhiteListFarmIoc();

    const [whiteListFarmIoc, setWhiteListFarmIoc] = useState<TWhiteListFarmIoc[]>([]);

    useEffect(() => {
        if (!getWhiteListFarmIoc.data) return;
        setWhiteListFarmIoc(getWhiteListFarmIoc.data.items);
    }, [getWhiteListFarmIoc.data]);

    const add = (symbol: string) => createWhiteListFarmIoc.mutate({ symbol });
    const remove = (symbol: string) => removeWhiteListFarmIoc.mutate({ symbol });
    const clearAll = () => clearAllWhiteListFarmIoc.mutate();

    const handleUpdateSize = (e: React.FocusEvent<HTMLInputElement>, symbol: string) => {
        updateSize.mutate({ symbol, size: Number(e.target.value) });
    };

    const handleUpdateMaxSize = (e: React.FocusEvent<HTMLInputElement>, symbol: string) => {
        updateSize.mutate({ symbol, maxSize: Number(e.target.value) });
    };

    return (
        <Stack gap={"xs"} className="w-full">
            <Title order={5} c="dimmed">
                WhiteList Farm Ioc ({whiteListFarmIoc.length})
            </Title>

            {/* Search & Add Section */}
            <WhitelistIOCSymbol onAdd={add} listIgnore={getWhiteListFarmIoc.data?.items} />

            {/* Main Whitelist Card */}
            <Card withBorder radius="md" shadow="xs" p="sm" h={250}>
                <Group mb="xs">
                    <Group gap={"xs"}>
                        <Text fw={600} size="sm">
                            Danh sách WhiteList FarmIoc
                        </Text>
                        <Badge color="gray" variant="light">
                            {whiteListFarmIoc.length}
                        </Badge>
                    </Group>

                    <Button
                        size="xs"
                        color="red"
                        variant="light"
                        leftSection={<IconTrash size={14} />}
                        onClick={clearAll}
                        disabled={whiteListFarmIoc.length === 0}
                    >
                        Clear all
                    </Button>
                </Group>

                <Divider mb="xs" />

                <ScrollArea offsetScrollbars>
                    {whiteListFarmIoc.length === 0 ? (
                        <Text size="xs" c="dimmed" ta="center" py="sm">
                            Nodata
                        </Text>
                    ) : (
                        <Group gap={"sm"}>
                            {whiteListFarmIoc.map((item) => (
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
