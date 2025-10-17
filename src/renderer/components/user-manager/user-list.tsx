import { useCreateUid, useDeleteUid, useUpdateUid } from "@/api/tanstack/uid.tanstack";
import { useGetListUser } from "@/api/tanstack/user.tanstack";
import { formatLocalTime } from "@/helpers/function.helper";
import { TUid } from "@/types/uid.type";
import { TUserManager } from "@/types/user.type";
import {
    ActionIcon,
    Badge,
    Button,
    Card,
    Center,
    CopyButton,
    Divider,
    Group,
    Modal,
    Pagination,
    SimpleGrid,
    Skeleton,
    Stack,
    Text,
    TextInput,
    Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Check, Clock, Copy, Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import UserLoginSwitch from "./user-login-switch";

export default function UserList() {
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [selectedUser, setSelectedUser] = useState<TUserManager | null>(null);
    const [selectedUid, setSelectedUid] = useState<TUid | null>(null);
    const [newUid, setNewUid] = useState("");
    const [type, setType] = useState<"Create" | "Update">("Create");
    const [opened, { open, close }] = useDisclosure(false);

    const getListUser = useGetListUser({
        pagination: { page, pageSize },
        filters: {},
        sort: { sortBy: "createdAt", isDesc: true },
    });

    const createUid = useCreateUid();
    const updateUid = useUpdateUid();
    const deleteUid = useDeleteUid();

    const data = getListUser.data;
    const loading = getListUser.isLoading;

    const handleCreateUid = () => {
        if (type !== "Create") return;
        if (!newUid.trim() || !selectedUser) return;
        createUid.mutate(
            { userId: selectedUser.id, uid: Number(newUid) },
            {
                onSuccess: () => {
                    setNewUid("");
                    close();
                },
            },
        );
    };

    const handleUpdateUid = () => {
        if (type !== "Update") return;
        if (!newUid.trim() || !selectedUid) return;
        updateUid.mutate(
            { id: selectedUid.id, uid: Number(newUid) },
            {
                onSuccess: () => {
                    setNewUid("");
                    close();
                },
            },
        );
    };

    const handleDeleteUid = (id: TUid["id"]) => {
        deleteUid.mutate({ id });
    };

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
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
                {data.items.map((user) => {
                    const isDisabled = !user.isLoginAllowed;
                    return (
                        <Card
                            key={user.id}
                            radius="md"
                            withBorder
                            shadow="sm"
                            p="sm"
                            style={{
                                opacity: isDisabled ? 0.6 : 1,
                                filter: isDisabled ? "grayscale(0.5)" : "none",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <Stack gap="xs">
                                <Group justify="space-between">
                                    <Badge
                                        size="sm"
                                        color={user.Roles?.id === 1 ? "grape" : user.Roles?.id === 3 ? "yellow" : "blue"}
                                        variant="filled"
                                    >
                                        {user.Roles?.description || "Unknown"}
                                    </Badge>
                                </Group>

                                <Stack gap={0}>
                                    <Text fw={600} size="md" c={isDisabled ? "dimmed" : "blue"}>
                                        {user.email}
                                    </Text>

                                    <Group gap={6}>
                                        <Clock size={14} color="gray" />
                                        <Text size="xs" c="dimmed">
                                            {formatLocalTime(user.createdAt)} ({formatLocalTime(user.createdAt, "ago")})
                                        </Text>
                                    </Group>
                                </Stack>

                                {/* UID Section */}
                                {user.Uids?.length > 0 ? (
                                    <Stack gap={4} mt="xs">
                                        {user.Uids.map((uid) => (
                                            <Group key={uid.id} gap={4}>
                                                <Text size="sm" fw={"bold"}>
                                                    {uid.uid}
                                                </Text>
                                                <Group gap={2}>
                                                    <CopyButton value={String(uid.uid)} timeout={1500}>
                                                        {({ copied, copy }) => (
                                                            <Tooltip label={copied ? "Copied!" : "Copy UID"} withArrow>
                                                                <ActionIcon onClick={copy} color={copied ? "teal" : "gray"} size="xs" variant="light">
                                                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        )}
                                                    </CopyButton>

                                                    <Tooltip label="Edit" withArrow>
                                                        <ActionIcon
                                                            size="xs"
                                                            variant="light"
                                                            onClick={() => {
                                                                setType("Update");
                                                                setSelectedUid(uid);
                                                                open();
                                                            }}
                                                        >
                                                            <Edit size={14} />
                                                        </ActionIcon>
                                                    </Tooltip>

                                                    <Tooltip label="Delete" withArrow>
                                                        <ActionIcon size="xs" color="red" variant="light" onClick={() => handleDeleteUid(uid.id)}>
                                                            <Trash2 size={14} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </Group>
                                            </Group>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Button
                                        variant="light"
                                        size="xs"
                                        leftSection={<Plus size={14} />}
                                        onClick={() => {
                                            setType("Create");
                                            setSelectedUser(user);
                                            open();
                                        }}
                                    >
                                        Add UID
                                    </Button>
                                )}
                            </Stack>

                            <Divider my="xs" />

                            <Group justify="space-between">
                                <UserLoginSwitch userId={user.id} initial={user.isLoginAllowed} />
                            </Group>
                        </Card>
                    );
                })}
            </SimpleGrid>

            {data.totalPage > 1 && (
                <Center mt="md">
                    <Pagination total={data.totalPage} value={page} onChange={setPage} color="blue" size="sm" radius="md" />
                </Center>
            )}

            {/* Add UID Modal */}
            <Modal opened={opened} onClose={close} centered title={`${type} ${selectedUser?.email || ""}`} radius="md">
                <Stack>
                    <TextInput label="UID" placeholder="Enter UID" value={newUid} onChange={(e) => setNewUid(e.currentTarget.value)} />
                    <Group justify="flex-end">
                        <Button size="sm" variant="default" onClick={close}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                if (type === "Create") handleCreateUid();
                                if (type === "Update") handleUpdateUid();
                            }}
                            loading={createUid.isPending}
                        >
                            {type}
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    );
}
