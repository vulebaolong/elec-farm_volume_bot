"use client";

import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { useGetSettingUserById, useUpdateSettingUser } from "@/api/tanstack/setting-user.tanstack";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { EntrySignalMode } from "@/types/enum/entry-signal-mode.enum";
import { TSettingUsersUpdate } from "@/types/setting-user.type";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Group, NumberInput, Radio, Stack, Text } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ButtonLoading } from "../ui/button-loading";
import { Form } from "../ui/form";

const numberFromStringOrNumber = z.union([
    z.number(),
    z
        .string()
        .trim()
        .min(1, "Required")
        .regex(/^[+-]?(\d+(\.\d+)?|\.\d+)$/, "Type number only")
        .transform((s) => Number(s)),
]);

const intField = (min = 1, label = "Value") =>
    numberFromStringOrNumber.refine((v) => Number.isInteger(v), "Type integer only").refine((v) => v >= min, `${label} must be ≥ ${min}`);

const numberRange = (min: number, max: number, label = "Value") =>
    numberFromStringOrNumber.refine((v) => v >= min && v <= max, `${label} must be between ${min} and ${max}`);

const positiveNumber = (label = "Value") => numberFromStringOrNumber.refine((v) => v > 0, `${label} must be > 0`);

export const FormSchema = z.object({
    maxTotalOpenPO: intField(1, "Maximum Position"),
    leverage: intField(1, "Leverage"),
    inputUSDT: intField(1, "Input USDT"),
    takeProfit: positiveNumber("Take Profit"),
    stopLoss: positiveNumber("Stop Loss"),
    timeoutMs: intField(1, "Timeout (ms)"),
    timeoutEnabled: z.boolean(),
    minSpreadPercent: numberRange(0, 100, "Min Spread %"),
    maxSpreadPercent: numberRange(0, 100, "Max Spread %"),
    maxDepth: positiveNumber("Max Depth"),
    timeoutClearOpenSecond: positiveNumber("Timeout Clear Open"),
    lastPriceGapGateAndBinancePercent: numberRange(0, 100, "Max Spread %"),
    ifImbalanceBidPercent: numberRange(0, 100, "Imbalance Bid %"),
    ifImbalanceAskPercent: numberRange(0, 100, "Imbalance Ask %"),
    entrySignalMode: z.enum(EntrySignalMode),
    delayForPairsMs: intField(1, "Delay For Pairs (ms)"),
    // max24hChangeGreen: numberRange(0, 100, "24h Change Green %"),
    // max24hChangeRed: numberRange(0, 100, "24h Change Red %"),
});

type FormInput = z.input<typeof FormSchema>; // kiểu dữ liệu TRƯỚC khi Zod parse ('' | string | number)
type FormOutput = z.output<typeof FormSchema>; // kiểu dữ liệu SAU khi Zod parse (number)\

type TProps = {
    type: "admin" | "user";
};

export default function SettingAdminUser({ type }: TProps) {
    const updateSettingUser = useUpdateSettingUser();
    const getInfoMutation = useGetInfoMutation();
    const getSettingUserById = useGetSettingUserById(1);
    const settingUser = useAppSelector((state) => state.user.info?.SettingUsers);
    const queryClient = useQueryClient();

    useEffect(() => {
        // Khi vào trang, nếu đang focus vào input nào đó thì bỏ focus
        const el = document.activeElement as HTMLElement | null;
        if (el && el !== document.body) el.blur();
    }, []);

    const form = useForm<FormInput>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            maxTotalOpenPO: "",
            leverage: "",
            inputUSDT: "",
            takeProfit: "",
            stopLoss: "",
            timeoutMs: "",
            timeoutEnabled: false,
            minSpreadPercent: "",
            maxSpreadPercent: "",
            maxDepth: "",
            timeoutClearOpenSecond: "",
            lastPriceGapGateAndBinancePercent: "",
            ifImbalanceBidPercent: "",
            ifImbalanceAskPercent: "",
            entrySignalMode: EntrySignalMode.IMBALANCE,
            delayForPairsMs: "",
            // max24hChangeGreen: "",
            // max24hChangeRed: "",
        },
    });

    useEffect(() => {
        const setting = type === "user" ? getSettingUserById.data : settingUser;
        if (setting) {
            form.reset({
                maxTotalOpenPO: setting.maxTotalOpenPO ?? "",
                leverage: setting.leverage ?? "",
                inputUSDT: setting.inputUSDT ?? "",
                takeProfit: setting.takeProfit ?? "",
                stopLoss: setting.stopLoss ?? "",
                timeoutMs: setting.timeoutMs ?? "",
                timeoutEnabled: setting.timeoutEnabled ?? false,
                minSpreadPercent: setting.minSpreadPercent ?? "",
                maxSpreadPercent: setting.maxSpreadPercent ?? "",
                maxDepth: setting.maxDepth ?? "",
                timeoutClearOpenSecond: setting.timeoutClearOpenSecond ?? "",
                lastPriceGapGateAndBinancePercent: setting.lastPriceGapGateAndBinancePercent ?? "",
                ifImbalanceAskPercent: setting.ifImbalanceAskPercent ?? "",
                ifImbalanceBidPercent: setting.ifImbalanceBidPercent ?? "",
                entrySignalMode: setting.entrySignalMode ?? EntrySignalMode.IMBALANCE,
                delayForPairsMs: setting.delayForPairsMs ?? "",
                // max24hChangeGreen: setting.max24hChangeGreen ?? "",
                // max24hChangeRed: setting.max24hChangeRed ?? "",
            });
        }
    }, [settingUser, getSettingUserById.data, form]);

    function onSubmit(raw: FormInput) {
        if (settingUser?.id === undefined) return;
        const data: FormOutput = FormSchema.parse(raw); // đảm bảo đã là number

        const payload: TSettingUsersUpdate = {
            id: type === "user" ? 1 : settingUser.id,
            maxTotalOpenPO: data.maxTotalOpenPO,
            leverage: data.leverage,
            inputUSDT: data.inputUSDT,
            takeProfit: data.takeProfit,
            stopLoss: data.stopLoss,
            timeoutMs: data.timeoutMs,
            timeoutEnabled: data.timeoutEnabled,
            minSpreadPercent: data.minSpreadPercent,
            maxSpreadPercent: data.maxSpreadPercent,
            maxDepth: data.maxDepth,
            timeoutClearOpenSecond: data.timeoutClearOpenSecond,
            lastPriceGapGateAndBinancePercent: data.lastPriceGapGateAndBinancePercent,
            ifImbalanceBidPercent: data.ifImbalanceBidPercent,
            ifImbalanceAskPercent: data.ifImbalanceAskPercent,
            entrySignalMode: data.entrySignalMode,
            delayForPairsMs: data.delayForPairsMs,
            // max24hChangeGreen: data.max24hChangeGreen,
            // max24hChangeRed: data.max24hChangeRed,
        };

        console.log({ updateSettingUser: payload });

        updateSettingUser.mutate(payload, {
            onSuccess: (data) => {
                console.log({ type });
                if (type === "user") {
                    queryClient.invalidateQueries({ queryKey: [`get-setting-user-by-id`] });
                } else {
                    getInfoMutation.mutate();
                }
                toast.success(`Update Setting successfully`);
            },
            onError: (error) => {
                console.log({ useUpdateSetting: error });
                toast.error(resError(error, `Update Setting failed`));
            },
        });
    }

    return (
        <Form {...form}>
            <form className="w-full grid gap-2 p-5 border border-border rounded-2xl" onSubmit={form.handleSubmit(onSubmit)}>
                {/* title */}
                <p className="text-xl font-bold text-muted-foreground">{type === "admin" ? "My Setting" : "Setting User"}</p>

                {/* takeProfit */}
                <Controller
                    name="takeProfit"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Take Profit"
                            placeholder="Take Profit"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.takeProfit?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={0.1}
                            clampBehavior="strict"
                        />
                    )}
                />

                {/* stopLoss */}
                <Controller
                    name="stopLoss"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Stop Loss"
                            placeholder="Stop Loss"
                            inputWrapperOrder={["label", "input", "description", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.stopLoss?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={0.1}
                            clampBehavior="strict"
                            description={"If 100 OFF SL | 1 = 1%"}
                        />
                    )}
                />

                {/* maxTotalOpenPO */}
                <Controller
                    name="maxTotalOpenPO"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Maximum Position"
                            placeholder="Maximum Position"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.maxTotalOpenPO?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={1}
                            clampBehavior="strict"
                        />
                    )}
                />

                {/* leverage */}
                <Controller
                    name="leverage"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Leverage"
                            placeholder="Leverage"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.leverage?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={1}
                            clampBehavior="strict"
                        />
                    )}
                />

                {/* inputUSDT */}
                <Controller
                    name="inputUSDT"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Input USDT"
                            placeholder="Input USDT"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.inputUSDT?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            suffix="$"
                            min={0}
                            step={1}
                            clampBehavior="strict"
                        />
                    )}
                />

                {/* timeoutMs */}
                <Controller
                    name="timeoutMs"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Timeout (milliseconds)"
                            placeholder="Timeout in milliseconds"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.timeoutMs?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            suffix="ms"
                            min={0}
                            step={1000}
                            clampBehavior="strict"
                            disabled={!form.watch("timeoutEnabled")} // chỉ bật khi timeoutEnabled = true
                        />
                    )}
                />

                {/* timeoutEnabled checkbox */}
                <Controller
                    name="timeoutEnabled"
                    control={form.control}
                    render={({ field }) => (
                        <Checkbox
                            size="xs"
                            label="Enable Timeout"
                            checked={field.value}
                            onChange={(event) => field.onChange(event.currentTarget.checked)}
                        />
                    )}
                />

                {/* minSpreadPercent */}
                <Controller
                    name="minSpreadPercent"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Min Spread %"
                            placeholder="Min Spread %"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.minSpreadPercent?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            suffix="%"
                            min={0}
                            step={0.1}
                            clampBehavior="strict"
                        />
                    )}
                />

                {/* maxSpreadPercent */}
                <Controller
                    name="maxSpreadPercent"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Max Spread %"
                            placeholder="Max Spread %"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.maxSpreadPercent?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            suffix="%"
                            min={0}
                            step={0.1}
                            clampBehavior="strict"
                        />
                    )}
                />

                {/* maxDepth */}
                <Controller
                    name="maxDepth"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Max Depth"
                            placeholder="Max Depth"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.maxDepth?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={1}
                            clampBehavior="strict"
                        />
                    )}
                />

                {/* timeoutClearOpenSecond */}
                <Controller
                    name="timeoutClearOpenSecond"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Time Out Clear Open (second)"
                            placeholder="Time Out Clear Open (second)"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.maxDepth?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            suffix="s"
                            min={0}
                            step={1}
                            clampBehavior="strict"
                        />
                    )}
                />

                <Controller
                    name="entrySignalMode"
                    control={form.control}
                    render={({ field: fieldEntrySignalMode }) => (
                        <Radio.Group
                            value={fieldEntrySignalMode.value}
                            onChange={fieldEntrySignalMode.onChange}
                            label="Entry signal mode"
                            description="Choose 1 of 2 order entry mechanisms"
                            withAsterisk
                        >
                            <Stack pt="md" gap="xs">
                                <Radio.Card value={EntrySignalMode.IMBALANCE} radius="md" withBorder p={"sm"}>
                                    <Group wrap="nowrap" align="flex-start">
                                        <Radio.Indicator />
                                        <div className="flex-1">
                                            <Text fz={14} fw={600}>
                                                Imbalance (Bid/Ask %)
                                            </Text>

                                            {/* ifImbalanceBidPercent */}
                                            <Controller
                                                name="ifImbalanceBidPercent"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <NumberInput
                                                        disabled={fieldEntrySignalMode.value !== EntrySignalMode.IMBALANCE}
                                                        size="xs"
                                                        withAsterisk
                                                        label="Imbalance Bid %"
                                                        placeholder="Bid %"
                                                        inputWrapperOrder={["label", "input", "error"]}
                                                        value={field.value ?? ""}
                                                        onChange={(val) => field.onChange(val ?? "")}
                                                        onBlur={field.onBlur}
                                                        error={form.formState.errors.ifImbalanceBidPercent?.message}
                                                        decimalSeparator="."
                                                        thousandSeparator=","
                                                        suffix="%"
                                                        min={0}
                                                        step={0.1}
                                                        clampBehavior="strict"
                                                        hideControls
                                                    />
                                                )}
                                            />

                                            {/* ifImbalanceAskPercent */}
                                            <Controller
                                                name="ifImbalanceAskPercent"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <NumberInput
                                                        disabled={fieldEntrySignalMode.value !== EntrySignalMode.IMBALANCE}
                                                        size="xs"
                                                        withAsterisk
                                                        label="Imbalance Ask %"
                                                        placeholder="Ask %"
                                                        inputWrapperOrder={["label", "input", "error"]}
                                                        value={field.value ?? ""}
                                                        onChange={(val) => field.onChange(val ?? "")}
                                                        onBlur={field.onBlur}
                                                        error={form.formState.errors.ifImbalanceAskPercent?.message}
                                                        decimalSeparator="."
                                                        thousandSeparator=","
                                                        suffix="%"
                                                        min={0}
                                                        step={0.1}
                                                        clampBehavior="strict"
                                                        hideControls
                                                    />
                                                )}
                                            />
                                        </div>
                                    </Group>
                                </Radio.Card>

                                <Radio.Card value={EntrySignalMode.GAP} radius="md" withBorder p={"sm"}>
                                    <Group wrap="nowrap" align="flex-start">
                                        <Radio.Indicator />
                                        <div className="flex-1">
                                            <Text fz={14} fw={600}>
                                                Price Gap (Gate vs. Binance %)
                                            </Text>

                                            {/* lastPriceGapGateAndBinancePercent */}
                                            <Controller
                                                name="lastPriceGapGateAndBinancePercent"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <NumberInput
                                                        disabled={fieldEntrySignalMode.value !== EntrySignalMode.GAP}
                                                        size="xs"
                                                        withAsterisk
                                                        label="Last Price Gap (Gate vs. Binance) %"
                                                        placeholder="Gap %"
                                                        inputWrapperOrder={["label", "input", "error"]}
                                                        value={field.value ?? ""}
                                                        onChange={(val) => field.onChange(val ?? "")}
                                                        onBlur={field.onBlur}
                                                        error={form.formState.errors.lastPriceGapGateAndBinancePercent?.message}
                                                        decimalSeparator="."
                                                        thousandSeparator=","
                                                        suffix="%"
                                                        min={0}
                                                        step={0.1}
                                                        clampBehavior="strict"
                                                        hideControls
                                                    />
                                                )}
                                            />
                                        </div>
                                    </Group>
                                </Radio.Card>
                            </Stack>
                        </Radio.Group>
                    )}
                />

                {/* delayForPairsMs */}
                <Controller
                    name="delayForPairsMs"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Delay for pairs (ms)"
                            placeholder="Delay (ms)"
                            inputWrapperOrder={["label", "input", "description", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.timeoutMs?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            suffix="ms"
                            min={0}
                            step={1000}
                            clampBehavior="strict"
                            description={"If 0 then no delay | 1000ms = 1second"}
                        />
                    )}
                />

                <ButtonLoading className="w-[80px]" loading={updateSettingUser.isPending} type="submit">
                    Save
                </ButtonLoading>
            </form>
        </Form>
    );
}
