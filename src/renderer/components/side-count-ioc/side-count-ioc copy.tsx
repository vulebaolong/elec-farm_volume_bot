import { Badge, Box, Flex, Group, Paper, Progress, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

type SideCountItem = {
    keyPrevSidesCount: string;
    longHits: number;
    shortHits: number;
};
type WorkerMsg = {
    type: "bot:ioc:sideCount";
    payload: { sideCountItem: SideCountItem[]; tauS: number; stepS: number };
    uid: number;
};

const STEP_VALUE = 10; // % mỗi nấc (3 nấc = 30%)
const DISABLED = "gray";
const GREEN = "green";
const RED = "red";

// Vị trí mốc theo %

const ZERO_MARK = 50; // 0     -> 50%

function symbolFromKey(key: string) {
    const parts = key.split(":");
    return parts[parts.length - 1] || key;
}

export default function SideCountIoc() {
    const [rows, setRows] = useState<Record<string, SideCountItem>>({});
    const [tauS, setTauS] = useState<number>(0);
    const [N_STEPS, setN_STEPS] = useState(1);

    // 🧮 Tính toán STEP_VALUE và CENTER_VALUE động
    const SIDE_PERCENT = 30; // tổng phần trăm mỗi bên
    const STEP_VALUE = SIDE_PERCENT / N_STEPS;
    const CENTER_VALUE = 100 - SIDE_PERCENT * 2; // luôn 40%

    // Các mốc trái/phải
    const LEFT_MARK = SIDE_PERCENT; // 30%
    const RIGHT_MARK = 100 - SIDE_PERCENT; // 70%

    useEffect(() => {
        const off = window.electron.ipcRenderer.on("bot:ioc:sideCount", (msg: WorkerMsg) => {
            if (tauS !== msg.payload.tauS) {
                setTauS(msg.payload.tauS);
            }
            if (tauS !== msg.payload.stepS) {
                setN_STEPS(msg.payload.stepS);
            }
            setRows((prev) => {
                const next = { ...prev };
                for (const it of msg.payload.sideCountItem || []) next[it.keyPrevSidesCount] = it;
                return next;
            });
        });
        return () => {
            off?.();
        };
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

                const shortSections = Array.from({ length: N_STEPS }, (_, i) => {
                    const level = i + 1;
                    return {
                        value: STEP_VALUE,
                        color: s >= level ? `${RED}.9` : `${DISABLED}.7`,
                        key: `s${level}`,
                    };
                }).reverse();
                const centerSection = [{ value: CENTER_VALUE, color: DISABLED, key: "c" }];
                const longSections = Array.from({ length: N_STEPS }, (_, i) => {
                    const level = i + 1; // step bắt đầu từ 1
                    return {
                        value: STEP_VALUE,
                        // Nếu đã đạt tới level thì dùng màu xanh, ngược lại là màu mờ
                        color: l >= level ? `${GREEN}.${5 + (level - 1) * 2}` : `${DISABLED}.${7 + (level - 1) * 0.5}`,
                        key: `l${level}`,
                    };
                });

                return (
                    <Box key={it.keyPrevSidesCount} mb="md">
                        <Text size="xs" fw={600}>
                            {sym}
                        </Text>

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
                                -{tauS}
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
                                +{tauS}
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
