// SessionsManager.tsx
"use client";

import { useEffect, useState } from "react";
import { ActionIcon, Badge, Button, Card, Code, Group, Stack, Table, Text, Title, Tooltip, CopyButton, Notification } from "@mantine/core";
import { IconFolderOpen, IconTrash, IconRefresh, IconCheck, IconCopy } from "@tabler/icons-react";

type SessionInfo = {
    name: string; // "default" | "persist:xxx"
    path: string; // absolute
    existsOnDisk: boolean;
};

export default function SessionsManager() {
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [message, setMessage] = useState<string | null>(null);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const data: SessionInfo[] = await window.sessions.list();
            setSessions(data);
        } catch (e: any) {
            setMessage(`Load sessions failed: ${e?.message ?? e}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const clearOne = async (name: string) => {
        const confirmed = window.confirm(
            name === "default"
                ? "Xoá dữ liệu của DEFAULT session? (cookies, cache, storage)"
                : `Xoá dữ liệu của session "${name}"? (cookies, cache, storage)`,
        );
        if (!confirmed) return;

        setLoading(true);
        try {
            await window.sessions.clear(name);
            setMessage(`Đã xoá dữ liệu session: ${name}`);
            await fetchSessions();
        } catch (e: any) {
            setMessage(`Clear failed: ${e?.message ?? e}`);
        } finally {
            setLoading(false);
        }
    };

    const openFolder = async (name: string) => {
        try {
            await window.sessions.openPath(name);
        } catch (e: any) {
            setMessage(`Open folder failed: ${e?.message ?? e}`);
        }
    };

    return (
        <Stack gap="sm">
            <Group >
                <Title order={5}>Sessions</Title>
                <Button size="xs" variant="light" leftSection={<IconRefresh size={16} />} onClick={fetchSessions} loading={loading}>
                    Refresh
                </Button>
            </Group>

            {message && (
                <Notification onClose={() => setMessage(null)} withCloseButton color="gray" title="Info">
                    {message}
                </Notification>
            )}

            <Card withBorder radius="md" shadow="xs" p="sm">
                <Table striped highlightOnHover withColumnBorders>
                    <thead>
                        <tr>
                            <th style={{ width: 220 }}>Name</th>
                            <th>Path</th>
                            <th style={{ width: 210, textAlign: "right" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map((s) => (
                            <tr key={s.name}>
                                <td>
                                    <Group gap="xs">
                                        <Text fw={600} size="sm">
                                            {s.name}
                                        </Text>
                                        {s.name === "default" ? (
                                            <Badge color="gray" variant="light" size="sm">
                                                default
                                            </Badge>
                                        ) : (
                                            <Badge color="blue" variant="light" size="sm">
                                                persist
                                            </Badge>
                                        )}
                                    </Group>
                                </td>
                                <td>
                                    <Group gap="xs">
                                        <Code>{s.path}</Code>
                                        <CopyButton value={s.path} timeout={1200}>
                                            {({ copied, copy }) => (
                                                <Tooltip label={copied ? "Copied" : "Copy path"} withArrow position="right">
                                                    <ActionIcon variant="light" size="sm" onClick={copy}>
                                                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                                    </ActionIcon>
                                                </Tooltip>
                                            )}
                                        </CopyButton>
                                    </Group>
                                </td>
                                <td>
                                    <Group gap="xs" wrap="nowrap">
                                        <Button size="xs" variant="light" leftSection={<IconFolderOpen size={16} />} onClick={() => openFolder(s.name)}>
                                            Open folder
                                        </Button>
                                        <Button
                                            size="xs"
                                            color="red"
                                            variant="light"
                                            leftSection={<IconTrash size={16} />}
                                            onClick={() => clearOne(s.name)}
                                        >
                                            Clear
                                        </Button>
                                    </Group>
                                </td>
                            </tr>
                        ))}
                        {sessions.length === 0 && (
                            <tr>
                                <td colSpan={3}>
                                    <Text size="sm" color="dimmed" py={8}>
                                        No sessions found.
                                    </Text>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </Card>
        </Stack>
    );
}
