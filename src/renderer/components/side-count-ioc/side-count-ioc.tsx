import { Badge, Box, Flex, Group, Paper, Progress, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

type SideCountItem = {
    keyPrevSidesCount: string;
    longHits: number;
    shortHits: number;
};
type WorkerMsg = {
    type: "bot:ioc:sideCount";
    payload: SideCountItem[];
    uid: number;
};

const N_STEPS = 3; // số nấc mỗi phía
const STEP_VALUE = 10; // % mỗi nấc (3 nấc = 30%)
const CENTER_VALUE = 40; // % dead-band
const DISABLED = "gray";
const GREEN = "green";
const RED = "red";

// Vị trí mốc theo %
const LEFT_MARK = N_STEPS * STEP_VALUE; // -0.1  -> 30%
const RIGHT_MARK = N_STEPS * STEP_VALUE + CENTER_VALUE; // +0.1  -> 70%
const ZERO_MARK = 50; // 0     -> 50%

function symbolFromKey(key: string) {
    const parts = key.split(":");
    return parts[parts.length - 1] || key;
}

export default function SideCountIoc() {
    const [rows, setRows] = useState<Record<string, SideCountItem>>({});

    useEffect(() => {
        const off = window.electron.ipcRenderer.on("bot:ioc:sideCount", (msg: WorkerMsg) => {
            setRows((prev) => {
                const next = { ...prev };
                for (const it of msg.payload || []) next[it.keyPrevSidesCount] = it;
                return next;
            });
        });
        return () => off?.();
    }, []);

    const list = useMemo(() => Object.values(rows), [rows]);

    return (
        <Paper radius="md" withBorder p="md" className="max-h-80 overflow-y-auto">
            <Badge variant="light" color="gray">
                {list.length} symbols
            </Badge>

            {list.map((it) => {
                const sym = symbolFromKey(it.keyPrevSidesCount);
                const l = Math.max(0, Math.min(N_STEPS, it.longHits | 0));
                const s = Math.max(0, Math.min(N_STEPS, it.shortHits | 0));

                const shortSections = [
                    { value: STEP_VALUE, color: s >= 3 ? `${RED}.9` : `${DISABLED}.9`, key: "s3" },
                    { value: STEP_VALUE, color: s >= 2 ? `${RED}.7` : `${DISABLED}.8`, key: "s2" },
                    { value: STEP_VALUE, color: s >= 1 ? `${RED}.5` : `${DISABLED}.7`, key: "s1" },
                ];
                const centerSection = [{ value: CENTER_VALUE, color: DISABLED, key: "c" }];
                const longSections = [
                    { value: STEP_VALUE, color: l >= 1 ? `${GREEN}.5` : `${DISABLED}.7`, key: "l1" },
                    { value: STEP_VALUE, color: l >= 2 ? `${GREEN}.7` : `${DISABLED}.8`, key: "l2" },
                    { value: STEP_VALUE, color: l >= 3 ? `${GREEN}.9` : `${DISABLED}.9`, key: "l3" },
                ];

                return (
                    <Box key={it.keyPrevSidesCount} mb="md">
                        <Group mb={6}>
                            <Text size="xs" fw={600}>
                                {sym}
                            </Text>
                            <Text size="xs" c="dimmed">
                                S:{it.shortHits} | L:{it.longHits}
                            </Text>
                        </Group>

                        {/* Wrapper tương đối để cắm mốc tuyệt đối */}
                        <Box pos="relative">
                            <Progress.Root size="lg" radius="xl">
                                {shortSections.map((sec) => (
                                    <Progress.Section key={sec.key} value={sec.value} color={sec.color}>
                                        <Progress.Label>short</Progress.Label>
                                    </Progress.Section>
                                ))}
                                {centerSection.map((sec) => (
                                    <Progress.Section key={sec.key} value={sec.value} color={sec.color}>
                                        <Progress.Label>hold</Progress.Label>
                                    </Progress.Section>
                                ))}
                                {longSections.map((sec) => (
                                    <Progress.Section key={sec.key} value={sec.value} color={sec.color}>
                                        <Progress.Label>long</Progress.Label>
                                    </Progress.Section>
                                ))}
                            </Progress.Root>

                            {/* Gạch đứng tại -0.1 (30%) */}
                            <Box
                                style={{
                                    position: "absolute",
                                    left: `${LEFT_MARK}%`,
                                    top: 0,
                                    height: "100%", // vươn xuống nhãn
                                    width: 2,
                                    background: "var(--mantine-color-yellow-6)",
                                    pointerEvents: "none",
                                    borderRadius: "2px",
                                }}
                            />
                            {/* Gạch đứng tại +0.1 (70%) */}
                            <Box
                                style={{
                                    position: "absolute",
                                    left: `${RIGHT_MARK}%`,
                                    top: 0,
                                    height: "100%",
                                    width: 2,
                                    background: "var(--mantine-color-yellow-6)",
                                    pointerEvents: "none",
                                    borderRadius: "2px",
                                }}
                            />

                            {/* Nhãn -0.1 / 0 / +0.1 đúng vị trí */}
                            <Text
                                size="xs"
                                c="dimmed"
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: `${LEFT_MARK}%`,
                                    transform: "translate(-50%, 4px)",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                -0.1
                            </Text>
                            <Text
                                size="xs"
                                c="dimmed"
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: `${ZERO_MARK}%`,
                                    transform: "translate(-50%, 4px)",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                0
                            </Text>
                            <Text
                                size="xs"
                                c="dimmed"
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: `${RIGHT_MARK}%`,
                                    transform: "translate(-50%, 4px)",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                +0.1
                            </Text>
                        </Box>
                    </Box>
                );
            })}

            {list.length === 0 && (
                <Text c="dimmed" size="sm">
                    No data
                </Text>
            )}
        </Paper>
    );
}
