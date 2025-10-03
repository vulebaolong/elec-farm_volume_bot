import { formatLocalTime } from "@/helpers/function.helper";
import { TFixStopLossInDB } from "@/types/fix-stoploss.type";
import { Badge, Divider, Group, Paper, Stack, Text } from "@mantine/core";
import FixStopLossRow from "./fix-stoploss-row";
import FixStopLossStatus from "./fix-stoploss-status";

function firstNonEmptyPrice(...values: (string | number | undefined)[]): string {
    for (const v of values) {
        if (v === undefined || v === null) continue;
        const s = typeof v === "string" ? v : String(v);
        if (s.trim() !== "" && s !== "0") return s;
    }
    return "-";
}

type TProps = {
    item: TFixStopLossInDB;
};

export default function FixStopLossItem({ item }: TProps) {
    // const optionsMartin = useAppSelector((state) => state.user.info?.SettingUsers.martingale?.options);
    const isDone = !!item?.isDone;
    const dataFix = item?.data;

    // Target (chỉ dùng cho header)
    const targetContract = dataFix?.dataStopLossShouldFix?.contract ?? "Idle";
    const targetStep = dataFix?.stepFixStopLoss ?? 0;
    const targetInputUSDT = dataFix.inputUSDTFix ?? "-";
    const targetLeverage = dataFix.leverageFix ?? "-";
    const targetLiqTime = dataFix.dataStopLossShouldFix?.open_time ? formatLocalTime(dataFix.dataStopLossShouldFix?.open_time) : "-";

    // Fix
    const fix = dataFix?.dataOrderOpenFixStopLoss;
    const fixContract = fix?.contract ?? "-";
    const fixPrice = firstNonEmptyPrice(fix?.price, fix?.fill_price);
    const fixCreatedAt = fix?.create_time ? formatLocalTime(fix?.create_time) : "-";

    // TP Fix
    const tp = dataFix?.dataCloseTP;
    const tpContract = tp?.contract ?? "-";
    const tpPrice = firstNonEmptyPrice(tp?.price, tp?.fill_price);
    const tpCreatedAt =tp?.create_time ? formatLocalTime(tp?.create_time) : "-";

    return (
        <Paper withBorder radius="md" p="sm">
            {/* Header trái: #id + 2 dòng + status (không có cột phải) */}
            <Group align="center" gap={10} mb={6} wrap="nowrap">
                <Badge variant="light" size="xs">
                    #{item.id}
                </Badge>

                <div className="flex flex-col leading-tight min-w-0">
                    <Group gap={6} align="center" wrap="nowrap" className="min-w-0">
                        <Text fz={12} fw={600} className="truncate">
                            {targetContract}
                        </Text>
                        <FixStopLossStatus item={item} />
                    </Group>

                    <Group gap={10} wrap="wrap" className="flex-1">
                        {[
                            ["Step", targetStep],
                            ["Input", targetInputUSDT],
                            ["Leverage", targetLeverage],
                            ["LiqAt", targetLiqTime],
                        ].map(([k, v]) => (
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
                </div>
            </Group>

            <Divider my={6} />

            {/* Body: CHỈ còn Fix và TP Fix */}
            <Stack gap={4}>
                <FixStopLossRow
                    label="Fix"
                    items={[
                        ["Contract", fixContract],
                        ["Price", fixPrice],
                        ["CreatedAt", fixCreatedAt],
                    ]}
                />
                <FixStopLossRow
                    label="TP Fix"
                    items={[
                        ["Contract", tpContract],
                        ["Price", tpPrice],
                        ["CreatedAt", tpCreatedAt],
                    ]}
                />
            </Stack>
        </Paper>
    );
}
