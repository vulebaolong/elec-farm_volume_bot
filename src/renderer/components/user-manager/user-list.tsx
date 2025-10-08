import { useGetListUser } from "@/api/tanstack/user.tanstack";
import { formatLocalTime } from "@/helpers/function.helper";
import {
    ActionIcon,
    Badge,
    Card,
    Center,
    CopyButton,
    Divider,
    Group,
    Pagination,
    SimpleGrid,
    Skeleton,
    Stack,
    Switch,
    Text,
    Tooltip,
} from "@mantine/core";
import { Check, CircleSlash, Clock, Copy, Edit, Play } from "lucide-react";
import { useState } from "react";

export default function UserList() {
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const getListUser = useGetListUser({
        pagination: { page, pageSize },
        filters: {},
        sort: { sortBy: "createdAt", isDesc: true },
    });

    const data = getListUser.data;
    const loading = getListUser.isLoading;

    if (loading) {
        return (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} height={150} radius="md" />
                ))}
            </SimpleGrid>
        );
    }

    if (!data?.items?.length) {
        return <Center>No users found</Center>;
    }

    return (
        <Stack>
            {/* Grid of user cards */}
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
                {data.items.map((user) => {
                    const isDisabled = !user.isLoginAllowed;
                    return (
                        <Card
                            key={user.id}
                            radius="lg"
                            withBorder
                            p="xs"
                            style={{
                                opacity: isDisabled ? 0.6 : 1,
                                filter: isDisabled ? "grayscale(0.6)" : "none",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <Stack className="flex-1" gap={"xs"}>
                                <Group justify="space-between" mb={6}>
                                    <Badge
                                        size="sm"
                                        color={user.Roles?.id === 1 ? "grape" : user.Roles?.id === 3 ? "yellow" : "blue"}
                                        variant="filled"
                                    >
                                        {user.Roles?.description || "Unknown"}
                                    </Badge>
                                </Group>

                                <Stack gap={0}>
                                    <Text fw={700} size="lg" c={isDisabled ? "dimmed" : "blue"}>
                                        {user.email}
                                    </Text>

                                    <Group gap="xs">
                                        <Clock size={14} color="gray" />
                                        <Text size="xs" c="dimmed">
                                            {formatLocalTime(user.createdAt)} ({formatLocalTime(user.createdAt, "ago")})
                                        </Text>
                                    </Group>
                                </Stack>

                                {user.Uids?.length > 0 && (
                                    <Stack gap={4} mt="xs">
                                        {user.Uids.map((uid) => (
                                            <Group key={uid.id} gap={4}>
                                                <Text size="xs" fw={500}>
                                                    UID: {uid.uid}
                                                </Text>
                                                <CopyButton value={String(uid.uid)} timeout={1500}>
                                                    {({ copied, copy }) => (
                                                        <Tooltip label={copied ? "Copied!" : "Copy UID"} withArrow>
                                                            <ActionIcon onClick={copy} color={copied ? "teal" : "gray"} size="xs" variant="light">
                                                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                                            </ActionIcon>
                                                        </Tooltip>
                                                    )}
                                                </CopyButton>
                                            </Group>
                                        ))}
                                    </Stack>
                                )}
                            </Stack>

                            <Divider my="xs" className="mt-auto" />

                            {/* Action Row */}
                            <Group justify="space-between">
                                <Switch size="xs" defaultChecked />

                                <ActionIcon variant="light" size="xs" color="green" disabled={isDisabled}>
                                    <Play size={16} />
                                </ActionIcon>

                                <ActionIcon variant="light" size="xs" color="red" disabled={isDisabled}>
                                    <CircleSlash size={16} />
                                </ActionIcon>

                                <ActionIcon variant="light" size="xs" color="blue" disabled={isDisabled}>
                                    <Edit size={16} />
                                </ActionIcon>
                            </Group>
                        </Card>
                    );
                })}
            </SimpleGrid>

            {/* Pagination */}
            {data.totalPage > 1 && (
                <Center mt="md">
                    <Pagination total={data.totalPage} value={page} onChange={setPage} color="blue" size="sm" radius="md" />
                </Center>
            )}
        </Stack>
    );
}
