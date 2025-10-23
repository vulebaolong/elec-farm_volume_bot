"use client";

import { useGetInfoMutation } from "@/api/tanstack/auth.tanstack";
import { useGetSettingUserById, useUpdateSettingUser } from "@/api/tanstack/setting-user.tanstack";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import { ELogType, logTypeOptions } from "@/types/enum/log-type.enum";
import { MartingaleConfig } from "@/types/martingale.type";
import { TTimeFrame, TSettingUsersUpdate } from "@/types/setting-user.type";
import { zodResolver } from "@hookform/resolvers/zod";
import { Divider, NumberInput, Select } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ButtonLoading } from "../ui/button-loading";
import { Form } from "../ui/form";
import { TauSWindowsEditor } from "./taus-windows-editor";

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

const HHMM = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be HH:mm (00:00-23:59)");

const toMinutes = (hhmm: string) => {
    const [hh, mm] = hhmm.split(":").map((v) => Number(v));
    return hh * 60 + mm; // 0..1439
};

export const ZTimeFrame = z
    .object({
        start: HHMM,
        end: HHMM,
        tauS: numberRange(0, 100, "Tau S"),
    })
    .superRefine((v, ctx) => {
        const s = toMinutes(v.start);
        const e = toMinutes(v.end);
        if (!(e > s)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "End must be > Start",
                path: ["end"],
            });
        }
    });

export const ZTimeFrameArray = z
    .array(ZTimeFrame)
    .max(24)
    .default([])
    .superRefine((arr, ctx) => {
        if (arr.length <= 1) return;

        // sort theo start (phút)
        const withIdx = arr.map((it, i) => ({ i, s: toMinutes(it.start), e: toMinutes(it.end) }));
        withIdx.sort((a, b) => a.s - b.s);

        for (let k = 0; k < withIdx.length - 1; k++) {
            const cur = withIdx[k];
            const nxt = withIdx[k + 1];
            // chồng chéo nếu next.start < cur.end
            if (nxt.s < cur.e) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Time windows must not overlap",
                    path: [cur.i, "end"],
                });
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Time windows must not overlap",
                    path: [nxt.i, "start"],
                });
                break;
            }
        }
    });

export const FormSchema = z.object({
    maxTotalOpenPO: intField(1, "Maximum Position"),
    leverage: intField(1, "Leverage"),
    stopLossUsdtPnl: positiveNumber("Stop Loss Usdt Pnl"),
    indexBidAsk: intField(1, "Index Bid/Ask"),
    delayFarm: intField(0, "Delay Farm (ms)"),
    delayScalp: intField(0, "Delay Scalp (ms)"),
    tauS: numberRange(0, 100, "Tau S"),
    logType: z.enum(ELogType).default(ELogType.Silent),
    stepS: intField(1, "Step S"),
    tauSWindow: ZTimeFrameArray,
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
            stopLossUsdtPnl: "",
            indexBidAsk: "",
            delayFarm: "",
            delayScalp: "",
            tauS: "",
            logType: ELogType.Silent,
            stepS: "",
            tauSWindow: [],
        },
    });

    useEffect(() => {
        const setting = type === "user" ? getSettingUserById.data : settingUser;
        if (setting) {
            form.reset({
                maxTotalOpenPO: setting.maxTotalOpenPO ?? "",
                leverage: setting.leverage ?? "",
                stopLossUsdtPnl: setting.stopLossUsdtPnl ?? "",
                indexBidAsk: setting.indexBidAsk ?? "",
                delayFarm: setting.delayFarm ?? "",
                delayScalp: setting.delayScalp ?? "",
                tauS: setting.tauS ?? "",
                logType: setting.logType ?? "",
                stepS: setting.stepS ?? "",
                tauSWindow: (setting.tauSWindow as TTimeFrame[] | null) ?? [],
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
            stopLossUsdtPnl: data.stopLossUsdtPnl,
            indexBidAsk: data.indexBidAsk,
            delayFarm: data.delayFarm,
            delayScalp: data.delayScalp,
            tauS: data.tauS,
            logType: data.logType,
            stepS: data.stepS,
            tauSWindow: data.tauSWindow,
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

    console.log(form.formState.errors);

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
                {/* <Controller
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
                /> */}

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

                <Controller
                    name="tauSWindow"
                    control={form.control}
                    render={({ field }) => (
                        <div>
                            <TauSWindowsEditor value={(field.value || []) as TTimeFrame[]} onChange={(next) => field.onChange(next)} />
                            {form.formState.errors.tauSWindow && (
                                <div style={{ color: "var(--mantine-color-red-6)", fontSize: 12, marginTop: 4 }}>
                                    {/* Hiển thị lỗi tổng thể nếu có (ví dụ chồng chéo) */}
                                    {(form.formState.errors.tauSWindow as any)?.message}
                                </div>
                            )}
                        </div>
                    )}
                />

                <ButtonLoading className="w-[80px]" loading={updateSettingUser.isPending} type="submit">
                    Save
                </ButtonLoading>
            </form>
        </Form>
    );
}
