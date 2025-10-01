import { Group, Text } from "@mantine/core";

type TProps = {
    label: string;
    items: [string, string][];
};

export default function FixLiquidationRow({ label, items }: TProps) {
    return (
        <Group align="start" gap={8} wrap="wrap">
            <Text fz={11} fw={600} className="w-[58px] shrink-0">
                {label}
            </Text>
            <Group gap={10} wrap="wrap" className="flex-1">
                {items.map(([k, v]) => (
                    <Group key={k} gap={6}>
                        <Text fz={11} c="dimmed">
                            {k}:
                        </Text>
                        <Text fz={11} fw={500}>
                            {v}
                        </Text>
                    </Group>
                ))}
            </Group>
        </Group>
    );
}
