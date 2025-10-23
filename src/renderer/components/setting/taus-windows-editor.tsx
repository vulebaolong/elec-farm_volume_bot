import { ActionIcon, Button, Group, NumberInput, Stack, Text } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { IconPlus, IconX } from "@tabler/icons-react";

export type TimeFrame = { start: string; end: string; tauS: number };

function toMinutes(hhmm: string): number {
    const [hh = "0", mm = "0"] = hhmm.split(":");
    const h = Math.max(0, Math.min(23, Number(hh) || 0));
    const m = Math.max(0, Math.min(59, Number(mm) || 0));
    return h * 60 + m;
}
function fromMinutes(mins: number): string {
    const m = Math.max(0, Math.min(23 * 60 + 59, mins));
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
}

type Props = {
    value: TimeFrame[];
    onChange: (next: TimeFrame[]) => void;
};

export function TauSWindowsEditor({ value, onChange }: Props) {
    const rows = value ?? [];

    const addRow = () => {
        if (rows.length === 0) {
            onChange([{ start: "00:00", end: "00:30", tauS: 0 }]);
            return;
        }
        const last = rows[rows.length - 1];
        const nextStart = fromMinutes(toMinutes(last.end)); // bắt đầu từ end của hàng trước
        const nextEnd = fromMinutes(toMinutes(last.end) + 30); // +30 phút (clamp 23:59)
        onChange([...rows, { start: nextStart, end: nextEnd, tauS: 0 }]);
    };

    const removeRow = (idx: number) => {
        const next = rows.slice();
        next.splice(idx, 1);
        onChange(next);
    };

    const updateRow = (idx: number, patch: Partial<TimeFrame>) => {
        const next = rows.slice();
        next[idx] = { ...next[idx], ...patch };
        onChange(next);
    };

    return (
        <Stack gap="xs">
            <Group justify="space-between" align="center">
                <Text fw={600} size="sm">
                    Tau S windows
                </Text>
                <Button leftSection={<IconPlus size={16} />} size="xs" variant="light" onClick={addRow}>
                    Add window
                </Button>
            </Group>

            {rows.length === 0 && (
                <Text c="dimmed" size="sm">
                    No windows. Click “Add window”.
                </Text>
            )}

            {rows.map((r, i) => (
                <Group key={i} gap="xs" wrap="nowrap" align="end">
                    <TimeInput
                        label="Start"
                        value={r.start}
                        onChange={(e) => updateRow(i, { start: e.currentTarget.value })}
                        size="xs"
                        withAsterisk
                    />
                    <TimeInput
                        label="End"
                        value={r.end}
                        onChange={(e) => updateRow(i, { end: e.currentTarget.value })}
                        size="xs"
                        withAsterisk
                        // description="Must be > Start"
                    />
                    <NumberInput
                        label="Tau S"
                        value={r.tauS}
                        onChange={(v) => updateRow(i, { tauS: (typeof v === "number" ? v : Number(v)) || 0 })}
                        size="xs"
                        min={0}
                        max={100}
                        step={0.1}
                        withAsterisk
                    />
                    <ActionIcon aria-label="Remove" variant="subtle" color="red" onClick={() => removeRow(i)} mb={4}>
                        <IconX size={16} />
                    </ActionIcon>
                </Group>
            ))}

            {rows.length > 0 && (
                <Text c="dimmed" size="xs">
                    • End phải lớn hơn Start. • Các khung không được chồng chéo. • Lưu đúng chuỗi “HH:mm”.
                </Text>
            )}
        </Stack>
    );
}
