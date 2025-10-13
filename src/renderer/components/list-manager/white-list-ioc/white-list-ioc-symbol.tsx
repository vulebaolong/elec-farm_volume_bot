"use client";

import { useGetSymbolGate } from "@/api/tanstack/symbol-gate.tanstack";
import { useGetWhiteListIoc } from "@/api/tanstack/white-list-ioc.tanstack";
import { AppendLoading } from "@/components/append-state/append-state";
import NodataOverlay from "@/components/no-data/NodataOverlay";
import { cn } from "@/lib/utils";
import { TSymbolGate } from "@/types/symbol-gate.type";
import { TWhiteListFarmIoc } from "@/types/white-list-farm-ioc.type";
import { TWhiteListScalpIoc } from "@/types/white-list-scalp-ioc.type";
import { Button, Group, Paper, Skeleton, Stack, Text, TextInput } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

type TProps = {
    onAdd?: (symbol: string) => void;
    listIgnore?: TWhiteListFarmIoc[] | TWhiteListScalpIoc[];
};

export default function WhitelistIOCSymbol({ onAdd, listIgnore }: TProps) {
    const [symbolWhiteListIOC, setSymbolWhiteListIOC] = useState<TSymbolGate[]>([]);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<{ symbol?: string }>({});
    const pageSize = 10;

    const totalItemRef = useRef(0);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const getSymbolWhiteListIOC = useGetWhiteListIoc({
        pagination: { page, pageSize },
        filters,
        sort: { sortBy: "createdAt", isDesc: true },
    });

    useEffect(() => {
        if (!getSymbolWhiteListIOC.data?.items) return;
        const newItems = getSymbolWhiteListIOC.data.items;

        setSymbolWhiteListIOC((prev) => {
            if (page === 1) return newItems;
            return [...prev, ...newItems];
        });
    }, [getSymbolWhiteListIOC.data?.items]);

    useEffect(() => {
        if (getSymbolWhiteListIOC.data?.totalItem) {
            totalItemRef.current = getSymbolWhiteListIOC.data.totalItem;
        }
    }, [getSymbolWhiteListIOC.data?.totalItem]);

    const handleEndReached = () => {
        if (getSymbolWhiteListIOC.isFetching || getSymbolWhiteListIOC.isLoading) return;
        if (symbolWhiteListIOC.length >= totalItemRef.current) return;
        setPage((prev) => prev + 1);
    };

    // Debounced search
    const handleSearch = useDebouncedCallback((value: string) => {
        setPage(1);
        setFilters(value ? { symbol: value } : {});
    }, 400);

    return (
        <Stack gap={"sm"} className="w-full h-[250px]">
            {/* Search input */}
            <TextInput
                placeholder="Tìm kiếm symbol..."
                leftSection={<IconSearch size={16} stroke={1.5} />}
                onChange={(e) => handleSearch(e.currentTarget.value)}
                radius="md"
                size="xs"
                classNames={{
                    input: "border-gray-300 focus:border-blue-500",
                }}
            />

            {/* List container */}
            <div ref={containerRef} className={cn("relative flex flex-col gap-2", "h-full", "overflow-y-auto", "rounded-md")}>
                <AppendLoading
                    isLoading={getSymbolWhiteListIOC.isLoading}
                    isEmpty={symbolWhiteListIOC.length === 0}
                    isError={getSymbolWhiteListIOC.isError}
                    onLoadMore={handleEndReached}
                    containerRef={containerRef}
                    footerLoadingComponent={Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} height={40} radius="md" />
                    ))}
                    initialLoadingComponent={Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} height={40} radius="md" />
                    ))}
                    noDataComponent={<NodataOverlay visible />}
                >
                    {symbolWhiteListIOC.map((item) => (
                        <Paper key={item.id} withBorder radius="md" p="xs">
                            <Group w={"100%"} align="center" justify="space-between">
                                <Text size="xs" fw={500}>
                                    {item.symbol}
                                </Text>
                                <Button
                                    size="xs"
                                    variant="light"
                                    color="blue"
                                    radius="md"
                                    leftSection={<IconPlus size={14} />}
                                    onClick={() => onAdd?.(item.symbol)}
                                    disabled={listIgnore?.some((i) => i.symbol === item.symbol)}
                                >
                                    Add
                                </Button>
                            </Group>
                        </Paper>
                    ))}
                </AppendLoading>
            </div>
        </Stack>
    );
}
