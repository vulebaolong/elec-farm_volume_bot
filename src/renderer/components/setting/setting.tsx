"use client";

import { useGetSetting, useUpdateSetting } from "@/api/tanstack/setting.tanstack";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, NumberInput } from "@mantine/core";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../ui/button";
import { ButtonLoading } from "../ui/button-loading";
import { Form } from "../ui/form";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";

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
});

type FormInput = z.input<typeof FormSchema>; // kiểu dữ liệu TRƯỚC khi Zod parse ('' | string | number)
type FormOutput = z.output<typeof FormSchema>; // kiểu dữ liệu SAU khi Zod parse (number)

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Setting({ open, onOpenChange: setOpen }: TProps) {
    const getSetting = useGetSetting();
    const updateSetting = useUpdateSetting();

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
        },
    });

    useEffect(() => {
        if (getSetting.data) {
            form.reset({
                maxTotalOpenPO: getSetting.data.maxTotalOpenPO ?? "",
                leverage: getSetting.data.leverage ?? "",
                inputUSDT: getSetting.data.inputUSDT ?? "",
                ifImbalanceBidPercent: getSetting.data.ifImbalanceBidPercent ?? "",
                ifImbalanceAskPercent: getSetting.data.ifImbalanceAskPercent ?? "",
                takeProfit: getSetting.data.takeProfit ?? "",
                stopLoss: getSetting.data.stopLoss ?? "",
                timeoutMs: getSetting.data.timeoutMs ?? "",
                timeoutEnabled: getSetting.data.timeoutEnabled ?? false,
            });
        }
    }, [getSetting.data, form]);

    function onSubmit(raw: FormInput) {
        const data: FormOutput = FormSchema.parse(raw); // đảm bảo đã là number

        const payload = {
            maxTotalOpenPO: data.maxTotalOpenPO,
            leverage: data.leverage,
            inputUSDT: data.inputUSDT,
            ifImbalanceBidPercent: data.ifImbalanceBidPercent,
            ifImbalanceAskPercent: data.ifImbalanceAskPercent,
            takeProfit: data.takeProfit,
            stopLoss: data.stopLoss,
            timeoutMs: data.timeoutMs,
            timeoutEnabled: data.timeoutEnabled,
        };
        console.log({ useUpdateSetting: payload });
        updateSetting.mutate(payload, {
            onSuccess: (data) => {
                // không cần load lại seting vì đã nhận được ở socket setting đặt ở app
                // queryClient.invalidateQueries({ queryKey: [`get-setting`] });
                toast.success(`Update Setting successfully`);
            },
            onError: (error) => {
                console.log({ useUpdateSetting: error });
                toast.error(resError(error, `Update Setting failed`));
            },
        });
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Setting</SheetTitle>
                </SheetHeader>
                {/* from */}
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} id="setting">
                        <div className="grid gap-2 px-5">
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
                        </div>
                    </form>
                </Form>
                <SheetFooter>
                    <div className="flex w-full items-center justify-between gap-2">
                        <ButtonLoading className="flex-1" loading={updateSetting.isPending} type="submit" form="setting">
                            Save
                        </ButtonLoading>
                        <SheetClose className="flex-1" asChild>
                            <Button variant="outline">Close</Button>
                        </SheetClose>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
