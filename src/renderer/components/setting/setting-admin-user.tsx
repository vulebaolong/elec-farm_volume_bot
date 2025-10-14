"use client";

import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { useGetSettingUserById, useUpdateSettingUser } from "@/api/tanstack/setting-user.tanstack";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { EntrySignalMode } from "@/types/enum/entry-signal-mode.enum";
import { MartingaleConfig, MartingaleOption } from "@/types/martingale.type";
import { TSettingUsersUpdate } from "@/types/setting-user.type";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Divider, Group, InputLabel, NumberInput, Paper, Radio, Stack, Text } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { Trash } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../ui/button";
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

export const ZMartingaleOption = z.object({
    inputUSDT: positiveNumber("Input (USDT)"),
    leverage: positiveNumber("Leverage"),
});

export const ZMartingaleConfig = z
    .object({
        initialInputUSDT: positiveNumber("Initial input (USDT)"),
        initialLeverage: positiveNumber("Initial leverage"),
        options: z.array(ZMartingaleOption).max(200).default([]),
    })
    // Không bắt buộc gấp thếp, nhưng bạn có thể cảnh báo nhẹ nếu không *ít nhất* tăng dần:
    .superRefine((val, ctx) => {
        for (let i = 1; i < val.options.length; i++) {
            if (val.options[i].inputUSDT <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Every step must have inputUSDT > 0",
                    path: ["options", i, "inputUSDT"],
                });
            }
        }
    });

export const FormSchema = z.object({
    maxTotalOpenPO: intField(1, "Maximum Position"),
    leverage: intField(1, "Leverage"),
    inputUSDT: intField(1, "Input USDT"),
    sizeIOC: intField(1, "size IOC"),
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
    delayForPairsMs: intField(0, "Delay For Pairs (ms)"),
    // max24hChangeGreen: numberRange(0, 100, "24h Change Green %"),
    // max24hChangeRed: numberRange(0, 100, "24h Change Red %"),

    martingale: ZMartingaleConfig,
    maxRoiNextPhase: positiveNumber("Max ROI Next Phase"),

    // ioc ----------------------
    // farm
    minSpreadPercentFarm: numberRange(0, 100, "Min Spread Farm %"),
    maxSpreadPercentFarm: numberRange(0, 100, "Max Spread Farm %"),
    ifImbalanceBidPercentFarm: numberRange(0, 100, "Imbalance Farm Bid %"),
    ifImbalanceAskPercentFarm: numberRange(0, 100, "Imbalance Farm Ask %"),
    lastPriceGapGateAndBinancePercentFarm: numberRange(0, 100, "Max Farm Gap %"),

    // scalp
    minSpreadPercentScalp: numberRange(0, 100, "Min Spread Scalp %"),
    maxSpreadPercentScalp: numberRange(0, 100, "Max Spread Scalp %"),
    ifImbalanceBidPercentScalp: numberRange(0, 100, "Imbalance Scalp Bid %"),
    ifImbalanceAskPercentScalp: numberRange(0, 100, "Imbalance Scalp Ask %"),
    lastPriceGapGateAndBinancePercentScalp: numberRange(0, 100, "Max Scalp Gap %"),

    indexBidAsk: intField(1, "Index Bid/Ask"),

    delayFarm: intField(0, "Delay Farm (ms)"),
    delayScalp: intField(0, "Delay Scalp (ms)"),
});

const defaultMartingale: MartingaleConfig = {
    initialInputUSDT: 10,
    initialLeverage: 25,
    options: [],
};

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
            sizeIOC: "",
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
            martingale: defaultMartingale,
            maxRoiNextPhase: "",

            // ioc ----------------------
            // farm
            minSpreadPercentFarm: "",
            maxSpreadPercentFarm: "",
            ifImbalanceBidPercentFarm: "",
            ifImbalanceAskPercentFarm: "",
            lastPriceGapGateAndBinancePercentFarm: "",

            // scalp
            minSpreadPercentScalp: "",
            maxSpreadPercentScalp: "",
            ifImbalanceBidPercentScalp: "",
            ifImbalanceAskPercentScalp: "",
            lastPriceGapGateAndBinancePercentScalp: "",

            indexBidAsk: "",
            delayFarm: "",
            delayScalp: "",
        },
    });

    useEffect(() => {
        const setting = type === "user" ? getSettingUserById.data : settingUser;
        if (setting) {
            form.reset({
                maxTotalOpenPO: setting.maxTotalOpenPO ?? "",
                leverage: setting.leverage ?? "",
                inputUSDT: setting.inputUSDT ?? "",
                sizeIOC: setting.sizeIOC ?? "",
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
                martingale: (setting.martingale as MartingaleConfig) ?? defaultMartingale,
                maxRoiNextPhase: setting.maxRoiNextPhase ?? "",

                // ioc ----------------------
                // farm
                minSpreadPercentFarm: setting.minSpreadPercentFarm ?? "",
                maxSpreadPercentFarm: setting.maxSpreadPercentFarm ?? "",
                ifImbalanceAskPercentFarm: setting.ifImbalanceAskPercentFarm ?? "",
                ifImbalanceBidPercentFarm: setting.ifImbalanceBidPercentFarm ?? "",
                lastPriceGapGateAndBinancePercentFarm: setting.lastPriceGapGateAndBinancePercentFarm ?? "",

                // scalp
                minSpreadPercentScalp: setting.minSpreadPercentScalp ?? "",
                maxSpreadPercentScalp: setting.maxSpreadPercentScalp ?? "",
                ifImbalanceAskPercentScalp: setting.ifImbalanceAskPercentScalp ?? "",
                ifImbalanceBidPercentScalp: setting.ifImbalanceBidPercentScalp ?? "",
                lastPriceGapGateAndBinancePercentScalp: setting.lastPriceGapGateAndBinancePercentScalp ?? "",

                indexBidAsk: setting.indexBidAsk ?? "",

                delayFarm: setting.delayFarm ?? "",
                delayScalp: setting.delayScalp ?? "",
            });
        }
    }, [settingUser, getSettingUserById.data, form, type]);

    function onSubmit(raw: FormInput) {
        if (settingUser?.id === undefined) return;

        const data: FormOutput = FormSchema.parse(raw); // đảm bảo đã là number

        const payload: TSettingUsersUpdate = {
            id: type === "user" ? 1 : settingUser.id,
            maxTotalOpenPO: data.maxTotalOpenPO,
            leverage: data.leverage,
            inputUSDT: data.inputUSDT,
            sizeIOC: data.sizeIOC,
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
            martingale: data.martingale,
            maxRoiNextPhase: data.maxRoiNextPhase,

            // ioc ----------------------
            // farm
            minSpreadPercentFarm: data.minSpreadPercentFarm,
            maxSpreadPercentFarm: data.maxSpreadPercentFarm,
            ifImbalanceBidPercentFarm: data.ifImbalanceBidPercentFarm,
            ifImbalanceAskPercentFarm: data.ifImbalanceAskPercentFarm,
            lastPriceGapGateAndBinancePercentFarm: data.lastPriceGapGateAndBinancePercentFarm,

            // scalp
            minSpreadPercentScalp: data.minSpreadPercentScalp,
            maxSpreadPercentScalp: data.maxSpreadPercentScalp,
            ifImbalanceBidPercentScalp: data.ifImbalanceBidPercentScalp,
            ifImbalanceAskPercentScalp: data.ifImbalanceAskPercentScalp,
            lastPriceGapGateAndBinancePercentScalp: data.lastPriceGapGateAndBinancePercentScalp,

            indexBidAsk: data.indexBidAsk,

            delayFarm: data.delayFarm,
            delayScalp: data.delayScalp,
        };

        console.log({ updateSettingUser: payload });

        updateSettingUser.mutate(payload, {
            onSuccess: (data) => {
                console.log({ type });
                if (type === "user") {
                    queryClient.invalidateQueries({ queryKey: [`get-setting-user-by-id`] });
                } else {
                    getInfoMutation.mutate(`update setting user`);
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
            <form className="w-full grid gap-2 p-5 border border-border rounded-2xl h-fit" onSubmit={form.handleSubmit(onSubmit)}>
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
                            suffix="%"
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
                            suffix="%"
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

                {/* entrySignalMode */}
                <Controller
                    name="entrySignalMode"
                    control={form.control}
                    render={({ field: fieldEntrySignalMode }) => {
                        const mode = fieldEntrySignalMode.value as EntrySignalMode;
                        const enableImb = mode === EntrySignalMode.IMBALANCE || mode === EntrySignalMode.BOTH;
                        const enableGap = mode === EntrySignalMode.GAP || mode === EntrySignalMode.BOTH;
                        const enableSideCCC = mode === EntrySignalMode.SIDE_CCC;

                        return (
                            <Radio.Group
                                value={mode}
                                onChange={fieldEntrySignalMode.onChange}
                                label="Entry signal mode"
                                description="Choose order entry mechanism"
                                withAsterisk
                            >
                                <Stack pt="md" gap="xs">
                                    <Paper withBorder radius="md" p="md">
                                        <Stack gap="xs">
                                            {/* IMBALANCE */}
                                            <Radio.Card value={EntrySignalMode.IMBALANCE} radius="md" withBorder p="sm">
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
                                                                    disabled={!enableImb || enableSideCCC}
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
                                                                    disabled={!enableImb || enableSideCCC}
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

                                            {/* GAP */}
                                            <Radio.Card value={EntrySignalMode.GAP} radius="md" withBorder p="sm">
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
                                                                    disabled={!enableGap || enableSideCCC}
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

                                            {/* BOTH */}
                                            <Radio.Card value={EntrySignalMode.BOTH} radius="md" withBorder p="sm">
                                                <Group wrap="nowrap" align="flex-start">
                                                    <Radio.Indicator />
                                                    <div className="flex-1">
                                                        <Text fz={14} fw={600}>
                                                            Both (Imbalance + Gap)
                                                        </Text>
                                                        <Text fz={12} c="dimmed">
                                                            Requires BOTH conditions (AND)
                                                        </Text>
                                                    </div>
                                                </Group>
                                            </Radio.Card>
                                        </Stack>
                                    </Paper>

                                    <Paper withBorder radius="md" p="md">
                                        {/* SIDE_CCC */}
                                        <Radio.Card value={EntrySignalMode.SIDE_CCC} radius="md" withBorder p="sm">
                                            <Group wrap="nowrap" align="flex-start">
                                                <Radio.Indicator />
                                                <div className="flex-1">
                                                    <Text fz={14} fw={600}>
                                                        SIDE_CCC
                                                    </Text>
                                                    <Text fz={12} c="dimmed">
                                                        Khi chọn SIDE_CCC, các điều kiện Imbalance/GAP/BOTH bị vô hiệu hóa.
                                                    </Text>
                                                </div>
                                            </Group>
                                        </Radio.Card>
                                    </Paper>
                                </Stack>
                            </Radio.Group>
                        );
                    }}
                />

                {/* martingale */}
                <Controller
                    name="martingale"
                    control={form.control}
                    render={({ field }) => {
                        // Giá trị mặc định nếu chưa có
                        const value: MartingaleConfig = (field.value as MartingaleConfig) ?? {
                            initialInputUSDT: 10,
                            initialLeverage: 25,
                            options: [],
                        };

                        function updateMartin(next: MartingaleConfig) {
                            field.onChange(next);
                        }

                        function updateRootField<K extends keyof MartingaleConfig>(key: K, newValue: MartingaleConfig[K]) {
                            updateMartin({ ...value, [key]: newValue });
                        }

                        function updateOptionAtIndex(optionIndex: number, patch: Partial<MartingaleOption>) {
                            const nextOptions = value.options.map((option, idx) => (idx === optionIndex ? { ...option, ...patch } : option));
                            updateMartin({ ...value, options: nextOptions });
                        }

                        function removeOptionAtIndex(optionIndex: number) {
                            const nextOptions = value.options.filter((_, idx) => idx !== optionIndex);
                            updateMartin({ ...value, options: nextOptions });
                        }

                        // Bấm + để thêm một bước:
                        // - Bước đầu: = initialInputUSDT
                        // - Bước sau: gấp đôi bước gần nhất
                        function addNextOption() {
                            const baseQuantity = Number(value.initialInputUSDT) || 0;
                            const hasAny = value.options.length > 0;
                            const lastQuantity = hasAny ? Number(value.options[value.options.length - 1].inputUSDT) || 0 : baseQuantity;
                            const nextQuantity = hasAny ? lastQuantity * 2 : baseQuantity;

                            const nextOption: MartingaleOption = {
                                inputUSDT: nextQuantity,
                                leverage: Number(value.initialLeverage) || 1,
                            };
                            updateMartin({ ...value, options: [...value.options, nextOption] });
                        }

                        // Grid 4 cột cố định để mọi hàng thẳng nhau:
                        // [nhãn 84px] [inputUSDT] [leverage] [actions]
                        const rowClass = "grid grid-cols-[50px_1fr_1fr_auto] gap-4 items-end";

                        return (
                            <div className="flex flex-col gap-4">
                                {/* Tiêu đề */}
                                <div className="text-sm font-medium">Martingale</div>

                                {/* Danh sách các bước */}
                                <Paper withBorder radius="md" p="md">
                                    {value.options.length === 0 ? (
                                        <div className="text-xs text-muted-foreground px-1 py-2">
                                            Chưa có bước nào. Nhấn “+ Thêm bước” để tạo bước đầu tiên (bằng Initial input). Các bước tiếp theo sẽ tự
                                            gấp đôi.
                                        </div>
                                    ) : (
                                        value.options.map((option, optionIndex) => (
                                            <div key={optionIndex} className={rowClass}>
                                                <div className="text-xs text-muted-foreground pt-5">Bước {optionIndex + 1}</div>

                                                <NumberInput
                                                    size="xs"
                                                    label="Input (USDT)"
                                                    value={option.inputUSDT}
                                                    onChange={(n) =>
                                                        updateOptionAtIndex(optionIndex, {
                                                            inputUSDT: Math.max(0, Number(n ?? 0)),
                                                        })
                                                    }
                                                    min={0}
                                                    step={1}
                                                    clampBehavior="strict"
                                                    hideControls
                                                />

                                                <NumberInput
                                                    size="xs"
                                                    label="Leverage (x)"
                                                    value={option.leverage}
                                                    onChange={(n) =>
                                                        updateOptionAtIndex(optionIndex, {
                                                            leverage: Math.max(0, Number(n ?? 0)),
                                                        })
                                                    }
                                                    min={0}
                                                    step={1}
                                                    clampBehavior="strict"
                                                    hideControls
                                                />
                                                <Button
                                                    color="red"
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="size-8"
                                                    onClick={() => removeOptionAtIndex(optionIndex)}
                                                >
                                                    <Trash />
                                                </Button>
                                            </div>
                                        ))
                                    )}

                                    {/* Nút thêm bước đặt NGAY DƯỚI danh sách, căn phải cho gọn */}
                                    <div className="mt-2 flex justify-end">
                                        <Button size={"sm"} type="button" onClick={addNextOption} title="Thêm một bước martingale">
                                            + Thêm
                                        </Button>
                                    </div>
                                </Paper>
                            </div>
                        );
                    }}
                />

                {/* maxRoiNextPhase */}
                <Controller
                    name="maxRoiNextPhase"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Max Roi% Next Phase"
                            placeholder="Max Roi% Next Phase"
                            inputWrapperOrder={["label", "input", "description", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.maxRoiNextPhase?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={0.1}
                            suffix="%"
                            clampBehavior="strict"
                            description={"If 0 OFF"}
                        />
                    )}
                />

                {/* sizeIOC */}
                <Controller
                    name="sizeIOC"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Size IOC"
                            placeholder="Size IOC"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.sizeIOC?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={1}
                            clampBehavior="strict"
                        />
                    )}
                />

                <Divider my="sm" />

                {/* ioc -------------------- */}
                {/* farm */}
                <InputLabel className="font-semibold">Farm</InputLabel>
                <Paper withBorder radius="md" p="md">
                    <Stack>
                        {/* spread */}
                        <Group>
                            <InputLabel size="xs" className="font-semibold" w={70}>
                                Spread
                            </InputLabel>
                            {/* minSpreadPercentFarm */}
                            <Controller
                                name="minSpreadPercentFarm"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.minSpreadPercentFarm?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="%"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />

                            <Text>~</Text>

                            {/* maxSpreadPercentFarm */}
                            <Controller
                                name="maxSpreadPercentFarm"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.maxSpreadPercentFarm?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="%"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />
                        </Group>

                        {/* imblance */}
                        <Group>
                            <InputLabel size="xs" className="font-semibold" w={70}>
                                Imblance
                            </InputLabel>
                            {/* ifImbalanceBidPercentFarm */}
                            <Controller
                                name="ifImbalanceBidPercentFarm"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.ifImbalanceBidPercentFarm?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="% bid"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />

                            <Text>~</Text>

                            {/* ifImbalanceAskPercentFarm */}
                            <Controller
                                name="ifImbalanceAskPercentFarm"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.ifImbalanceAskPercentFarm?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="% ask"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />
                        </Group>

                        {/* gap */}
                        <Group>
                            <InputLabel size="xs" className="font-semibold" w={70}>
                                Price Gap
                            </InputLabel>
                            {/* lastPriceGapGateAndBinancePercentFarm */}
                            <Controller
                                name="lastPriceGapGateAndBinancePercentFarm"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.lastPriceGapGateAndBinancePercentFarm?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="%"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />
                        </Group>
                    </Stack>
                </Paper>

                {/* scalp */}
                <InputLabel className="font-semibold">Scalp</InputLabel>
                <Paper withBorder radius="md" p="md">
                    <Stack>
                        {/* spread */}
                        <Group>
                            <InputLabel size="xs" className="font-semibold" w={70}>
                                Spread
                            </InputLabel>
                            {/* minSpreadPercentScalp */}
                            <Controller
                                name="minSpreadPercentScalp"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.minSpreadPercentScalp?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="%"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />

                            <Text>~</Text>

                            {/* maxSpreadPercentScalp */}
                            <Controller
                                name="maxSpreadPercentScalp"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.maxSpreadPercentScalp?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="%"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />
                        </Group>

                        {/* imblance */}
                        <Group>
                            <InputLabel size="xs" className="font-semibold" w={70}>
                                Imblance
                            </InputLabel>
                            {/* ifImbalanceBidPercentScalp */}
                            <Controller
                                name="ifImbalanceBidPercentScalp"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.ifImbalanceBidPercentScalp?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="% bid"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />

                            <Text>~</Text>

                            {/* ifImbalanceAskPercentScalp */}
                            <Controller
                                name="ifImbalanceAskPercentScalp"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.ifImbalanceAskPercentScalp?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="% ask"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />
                        </Group>

                        {/* gap */}
                        <Group>
                            <InputLabel size="xs" className="font-semibold" w={70}>
                                Price Gap
                            </InputLabel>
                            {/* lastPriceGapGateAndBinancePercentScalp */}
                            <Controller
                                name="lastPriceGapGateAndBinancePercentScalp"
                                control={form.control}
                                render={({ field }) => (
                                    <NumberInput
                                        size="xs"
                                        withAsterisk
                                        inputWrapperOrder={["input", "error"]}
                                        value={field.value ?? ""}
                                        onChange={(val) => field.onChange(val ?? "")}
                                        onBlur={field.onBlur}
                                        error={form.formState.errors.lastPriceGapGateAndBinancePercentScalp?.message}
                                        decimalSeparator="."
                                        thousandSeparator=","
                                        suffix="%"
                                        min={0}
                                        step={0.1}
                                        clampBehavior="strict"
                                    />
                                )}
                            />
                        </Group>
                    </Stack>
                </Paper>

                {/* delayFarm */}
                <Controller
                    name="delayFarm"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Delay Farm (ms)"
                            placeholder="Delay Farm (ms)"
                            inputWrapperOrder={["label", "input", "description", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.delayFarm?.message}
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

                {/* delayScalp */}
                <Controller
                    name="delayScalp"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Delay Scalp (ms)"
                            placeholder="Delay Scalp (ms)"
                            inputWrapperOrder={["label", "input", "description", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.delayScalp?.message}
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

                {/* indexBidAsk */}
                <Controller
                    name="indexBidAsk"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Index Bid/Ask"
                            placeholder="Index Bid/Ask"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.indexBidAsk?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={1}
                            step={5}
                            clampBehavior="strict"
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
