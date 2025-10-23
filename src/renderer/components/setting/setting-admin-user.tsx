"use client";

import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { useGetSettingUserById, useUpdateSettingUser } from "@/api/tanstack/setting-user.tanstack";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { EntrySignalMode } from "@/types/enum/entry-signal-mode.enum";
import { MartingaleConfig, MartingaleOption } from "@/types/martingale.type";
import { TSettingUsersUpdate } from "@/types/setting-user.type";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Divider, Group, InputLabel, NumberInput, Paper, Radio, Select, Stack, Text } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { Trash } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../ui/button";
import { ButtonLoading } from "../ui/button-loading";
import { Form } from "../ui/form";
import { ELogType, logTypeOptions } from "@/types/enum/log-type.enum";

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
    stopLossUsdtPnl: positiveNumber("Stop Loss Usdt Pnl"),
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

    tauS: numberRange(0, 100, "Tau S"),

    logType: z.enum(ELogType).default(ELogType.Silent),

    stepS: intField(1,"Step S"),
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
            stopLossUsdtPnl: "",
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

            tauS: "",

            logType: ELogType.Silent,

            stepS: "",
        },
    });

    useEffect(() => {
        const setting = type === "user" ? getSettingUserById.data : settingUser;
        if (setting) {
            form.reset({
                maxTotalOpenPO: setting.maxTotalOpenPO ?? "",
                leverage: setting.leverage ?? "",
                // inputUSDT: setting.inputUSDT ?? "",
                // sizeIOC: setting.sizeIOC ?? "",
                // takeProfit: setting.takeProfit ?? "",
                // stopLoss: setting.stopLoss ?? "",
                stopLossUsdtPnl: setting.stopLossUsdtPnl ?? "",
                // timeoutMs: setting.timeoutMs ?? "",
                // timeoutEnabled: setting.timeoutEnabled ?? false,
                // minSpreadPercent: setting.minSpreadPercent ?? "",
                // maxSpreadPercent: setting.maxSpreadPercent ?? "",
                // maxDepth: setting.maxDepth ?? "",
                // timeoutClearOpenSecond: setting.timeoutClearOpenSecond ?? "",
                // lastPriceGapGateAndBinancePercent: setting.lastPriceGapGateAndBinancePercent ?? "",
                // ifImbalanceAskPercent: setting.ifImbalanceAskPercent ?? "",
                // ifImbalanceBidPercent: setting.ifImbalanceBidPercent ?? "",
                // entrySignalMode: setting.entrySignalMode ?? EntrySignalMode.IMBALANCE,
                // delayForPairsMs: setting.delayForPairsMs ?? "",
                // max24hChangeGreen: setting.max24hChangeGreen ?? "",
                // max24hChangeRed: setting.max24hChangeRed ?? "",
                // martingale: (setting.martingale as MartingaleConfig) ?? defaultMartingale,
                // maxRoiNextPhase: setting.maxRoiNextPhase ?? "",

                // ioc ----------------------
                // farm
                // minSpreadPercentFarm: setting.minSpreadPercentFarm ?? "",
                // maxSpreadPercentFarm: setting.maxSpreadPercentFarm ?? "",
                // ifImbalanceAskPercentFarm: setting.ifImbalanceAskPercentFarm ?? "",
                // ifImbalanceBidPercentFarm: setting.ifImbalanceBidPercentFarm ?? "",
                // lastPriceGapGateAndBinancePercentFarm: setting.lastPriceGapGateAndBinancePercentFarm ?? "",

                // scalp
                // minSpreadPercentScalp: setting.minSpreadPercentScalp ?? "",
                // maxSpreadPercentScalp: setting.maxSpreadPercentScalp ?? "",
                // ifImbalanceAskPercentScalp: setting.ifImbalanceAskPercentScalp ?? "",
                // ifImbalanceBidPercentScalp: setting.ifImbalanceBidPercentScalp ?? "",
                // lastPriceGapGateAndBinancePercentScalp: setting.lastPriceGapGateAndBinancePercentScalp ?? "",

                indexBidAsk: setting.indexBidAsk ?? "",

                delayFarm: setting.delayFarm ?? "",
                delayScalp: setting.delayScalp ?? "",

                tauS: setting.tauS ?? "",

                logType: setting.logType ?? "",

                stepS: setting.stepS ?? "",
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
            // inputUSDT: data.inputUSDT,
            // sizeIOC: data.sizeIOC,
            // takeProfit: data.takeProfit,
            // stopLoss: data.stopLoss,
            stopLossUsdtPnl: data.stopLossUsdtPnl,
            // timeoutMs: data.timeoutMs,
            // timeoutEnabled: data.timeoutEnabled,
            // minSpreadPercent: data.minSpreadPercent,
            // maxSpreadPercent: data.maxSpreadPercent,
            // maxDepth: data.maxDepth,
            // timeoutClearOpenSecond: data.timeoutClearOpenSecond,
            // lastPriceGapGateAndBinancePercent: data.lastPriceGapGateAndBinancePercent,
            // ifImbalanceBidPercent: data.ifImbalanceBidPercent,
            // ifImbalanceAskPercent: data.ifImbalanceAskPercent,
            // entrySignalMode: data.entrySignalMode,
            // delayForPairsMs: data.delayForPairsMs,
            // max24hChangeGreen: data.max24hChangeGreen,
            // max24hChangeRed: data.max24hChangeRed,
            // martingale: data.martingale,
            // maxRoiNextPhase: data.maxRoiNextPhase,

            // ioc ----------------------
            // farm
            // minSpreadPercentFarm: data.minSpreadPercentFarm,
            // maxSpreadPercentFarm: data.maxSpreadPercentFarm,
            // ifImbalanceBidPercentFarm: data.ifImbalanceBidPercentFarm,
            // ifImbalanceAskPercentFarm: data.ifImbalanceAskPercentFarm,
            // lastPriceGapGateAndBinancePercentFarm: data.lastPriceGapGateAndBinancePercentFarm,

            // scalp
            // minSpreadPercentScalp: data.minSpreadPercentScalp,
            // maxSpreadPercentScalp: data.maxSpreadPercentScalp,
            // ifImbalanceBidPercentScalp: data.ifImbalanceBidPercentScalp,
            // ifImbalanceAskPercentScalp: data.ifImbalanceAskPercentScalp,
            // lastPriceGapGateAndBinancePercentScalp: data.lastPriceGapGateAndBinancePercentScalp,

            indexBidAsk: data.indexBidAsk,

            delayFarm: data.delayFarm,
            delayScalp: data.delayScalp,

            tauS: data.tauS,

            logType: data.logType,

            stepS: data.stepS,
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

                {/* stopLossUsdtPnl */}
                <Controller
                    name="stopLossUsdtPnl"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Stop Loss USDT PNL"
                            placeholder="Stop Loss USDT PNL"
                            inputWrapperOrder={["label", "input", "description", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.stopLossUsdtPnl?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            suffix=" USDT"
                            min={0}
                            step={0.1}
                            clampBehavior="strict"
                            description={"If 0 is OFF Stoploss USDT PNL"}
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


                <Divider my="sm" />

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

                {/* tauS */}
                <Controller
                    name="tauS"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Tau S"
                            placeholder="Tau S"
                            inputWrapperOrder={["label", "input", "description", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.tauS?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={0.1}
                            clampBehavior="strict"
                            description={`<--- Short -${settingUser?.tauS ?? "?"} ..... Hold 0 ..... ${settingUser?.tauS ?? "?"} Long --->`}
                        />
                    )}
                />

                {/* logType */}
                <Controller
                    name="logType"
                    control={form.control}
                    render={({ field }) => (
                        <Select
                            size="xs"
                            withAsterisk
                            label="Log type"
                            placeholder="Log type"
                            inputWrapperOrder={["label", "input", "error"]}
                            data={logTypeOptions}
                            value={String(field.value) ?? ""}
                            onChange={(val) => field.onChange(Number(val) ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.logType?.message}
                        />
                    )}
                />

                {/* stepS */}
                <Controller
                    name="stepS"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Step S"
                            placeholder="Step S"
                            inputWrapperOrder={["label", "input", "description", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.stepS?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={0.1}
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
