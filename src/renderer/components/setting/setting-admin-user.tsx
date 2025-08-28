"use client";

import { useGetSettingUserById, useUpdateSettingUser } from "@/api/tanstack/setting-user.tanstack";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { TSettingUsersUpdate } from "@/types/setting-user.type";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, NumberInput } from "@mantine/core";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ButtonLoading } from "../ui/button-loading";
import { Form } from "../ui/form";
import { useQueryClient } from "@tanstack/react-query";

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
    ifImbalanceBidPercent: numberRange(0, 100, "Imbalance Bid %"),
    ifImbalanceAskPercent: numberRange(0, 100, "Imbalance Ask %"),
    takeProfit: positiveNumber("Take Profit"),
    stopLoss: positiveNumber("Stop Loss"),
    timeoutMs: intField(1, "Timeout (ms)"),
    timeoutEnabled: z.boolean(),
    max24hChangeGreen: numberRange(0, 100, "24h Change Green %"),
    max24hChangeRed: numberRange(0, 100, "24h Change Red %"),
    minSpreadPercent: numberRange(0, 100, "Min Spread %"),
    maxSpreadPercent: numberRange(0, 100, "Max Spread %"),
    maxDepth: positiveNumber("Max Depth"),
    timeoutClearOpenSecond: positiveNumber("Timeout Clear Open"),
});

type FormInput = z.input<typeof FormSchema>; // kiểu dữ liệu TRƯỚC khi Zod parse ('' | string | number)
type FormOutput = z.output<typeof FormSchema>; // kiểu dữ liệu SAU khi Zod parse (number)\

type TProps = {
    type: "admin" | "user";
};

export default function SettingAdminUser({ type }: TProps) {
    const updateSettingUser = useUpdateSettingUser();
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
            ifImbalanceBidPercent: "",
            ifImbalanceAskPercent: "",
            takeProfit: "",
            stopLoss: "",
            timeoutMs: "",
            timeoutEnabled: false,
            max24hChangeGreen: "",
            max24hChangeRed: "",
            minSpreadPercent: "",
            maxSpreadPercent: "",
            maxDepth: "",
            timeoutClearOpenSecond: "",
        },
    });

    useEffect(() => {
        const setting = type === "user" ? getSettingUserById.data : settingUser;
        if (setting) {
            form.reset({
                maxTotalOpenPO: setting.maxTotalOpenPO ?? "",
                leverage: setting.leverage ?? "",
                inputUSDT: setting.inputUSDT ?? "",
                ifImbalanceBidPercent: setting.ifImbalanceBidPercent ?? "",
                ifImbalanceAskPercent: setting.ifImbalanceAskPercent ?? "",
                takeProfit: setting.takeProfit ?? "",
                stopLoss: setting.stopLoss ?? "",
                timeoutMs: setting.timeoutMs ?? "",
                timeoutEnabled: setting.timeoutEnabled ?? false,
                max24hChangeGreen: setting.max24hChangeGreen ?? "",
                max24hChangeRed: setting.max24hChangeRed ?? "",
                minSpreadPercent: setting.minSpreadPercent ?? "",
                maxSpreadPercent: setting.maxSpreadPercent ?? "",
                maxDepth: setting.maxDepth ?? "",
                timeoutClearOpenSecond: setting.timeoutClearOpenSecond ?? "",
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
            ifImbalanceBidPercent: data.ifImbalanceBidPercent,
            ifImbalanceAskPercent: data.ifImbalanceAskPercent,
            takeProfit: data.takeProfit,
            stopLoss: data.stopLoss,
            timeoutMs: data.timeoutMs,
            timeoutEnabled: data.timeoutEnabled,
            max24hChangeGreen: data.max24hChangeGreen,
            max24hChangeRed: data.max24hChangeRed,
            minSpreadPercent: data.minSpreadPercent,
            maxSpreadPercent: data.maxSpreadPercent,
            maxDepth: data.maxDepth,
            timeoutClearOpenSecond: data.timeoutClearOpenSecond,
        };
        console.log({ updateSettingUser: payload });
        updateSettingUser.mutate(payload, {
            onSuccess: (data) => {
                // không cần load lại seting vì đã nhận được ở socket setting đặt ở app
                if (type === "user") queryClient.invalidateQueries({ queryKey: [`get-setting-user-by-id`] });
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
            <form className="w-full grid gap-2 p-5 border border-border rounded-2xl shadow-lg" onSubmit={form.handleSubmit(onSubmit)}>
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
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.stopLoss?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            min={0}
                            step={0.1}
                            clampBehavior="strict"
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

                {/* ifImbalanceBidPercent */}
                <Controller
                    name="ifImbalanceBidPercent"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Imbalance Bid"
                            placeholder="Imbalance Bid"
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
                        />
                    )}
                />

                {/* ifImbalanceAskPercent */}
                <Controller
                    name="ifImbalanceAskPercent"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="Imbalance Ask"
                            placeholder="Imbalance Ask"
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

                {/* max24hChangeGreen */}
                <Controller
                    name="max24hChangeGreen"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="24h Change Green %"
                            placeholder="24h Change Green %"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.max24hChangeGreen?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            suffix="%"
                            min={0}
                            step={0.1}
                            clampBehavior="strict"
                        />
                    )}
                />

                {/* max24hChangeRed */}
                <Controller
                    name="max24hChangeRed"
                    control={form.control}
                    render={({ field }) => (
                        <NumberInput
                            size="xs"
                            withAsterisk
                            label="24h Change Red %"
                            placeholder="24h Change Red %"
                            inputWrapperOrder={["label", "input", "error"]}
                            value={field.value ?? ""}
                            onChange={(val) => field.onChange(val ?? "")}
                            onBlur={field.onBlur}
                            error={form.formState.errors.max24hChangeRed?.message}
                            decimalSeparator="."
                            thousandSeparator=","
                            suffix="%"
                            min={0}
                            step={0.1}
                            clampBehavior="strict"
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

                <ButtonLoading className="w-[80px]" loading={updateSettingUser.isPending} type="submit">
                    Save
                </ButtonLoading>
            </form>
        </Form>
    );
}
