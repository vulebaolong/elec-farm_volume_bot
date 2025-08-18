import React, { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { TextInput } from "@mantine/core";
import { Button } from "@/components/ui/button"; // shadcn/ui
import { useGetUiSelector, useUpsertUiSelector } from "@/api/tanstack/selector.tanstack";
import { Form } from "../ui/form";
import { TUiSelector } from "@/types/ui-selector.type";
import { z } from "zod";
import { ButtonLoading } from "../ui/button-loading";
import { toast } from "sonner";
import { resError } from "@/helpers/function.helper";
import { useAppSelector } from "@/redux/store";
import NodataOverlay from "../no-data/NodataOverlay";
import { useQueryClient } from "@tanstack/react-query";

export const FormSchema = z.object({
    id: z.any(),
    code: z.string(),
    selectorValue: z.string(),
    description: z.string(),
});

type FormInput = z.input<typeof FormSchema>;
type FormOutput = z.output<typeof FormSchema>;

// ---- Form model ----
export type TFormValuesUiSelector = {
    selectors: FormInput[];
};

export default function SettingSelector() {
    const uiSelector = useAppSelector((state) => state.bot.uiSelector);
    const upsertUiSelector = useUpsertUiSelector();
    const queryClient = useQueryClient();

    const form = useForm<TFormValuesUiSelector>({
        defaultValues: { selectors: [] },
        mode: "onBlur",
    });

    const { fields, append, replace } = useFieldArray({
        name: "selectors",
        control: form.control,
    });

    // Nạp dữ liệu từ API vào form
    useEffect(() => {
        const arr = uiSelector || [];
        const normalized = arr.map((it) => ({
            id: it.id,
            code: it.code ?? "",
            selectorValue: it.selectorValue ?? "",
            description: it.description ?? "",
        }));
        replace(normalized);
    }, [uiSelector, replace]);

    const addRow = () => {
        append({
            id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            code: "",
            selectorValue: "",
            description: "",
        });
    };

    function onSubmit(raw: TFormValuesUiSelector) {
        console.log({ SettingSelector: raw });
        upsertUiSelector.mutate(raw, {
            onSuccess: (data) => {
                queryClient.invalidateQueries({ queryKey: [`get-ui-selector`] });
                toast.success(`Update Ui Selector successfully`);
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
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">UI Selectors</h2>
                    <Button type="button" variant="secondary" className="rounded-2xl" onClick={addRow}>
                        + Thêm hàng
                    </Button>
                </div>

                {!uiSelector && <NodataOverlay />}

                {fields.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                        Chưa có selector nào. Bấm <b>Thêm hàng</b> để tạo mới.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="min-w-[900px] space-y-3">
                            {fields.map((field, idx) => (
                                <div key={field.id ?? idx} className="grid grid-cols-12 items-start gap-3 rounded-xl border p-3">
                                    {/* CODE */}
                                    <div className="col-span-12 md:col-span-3">
                                        <Controller
                                            name={`selectors.${idx}.code` as const}
                                            control={form.control}
                                            rules={{ required: "Bắt buộc" }}
                                            render={({ field }) => (
                                                <TextInput
                                                    size="xs"
                                                    withAsterisk
                                                    label="Code"
                                                    placeholder="inputAmount / positions.close_all …"
                                                    inputWrapperOrder={["label", "input", "error"]}
                                                    value={field.value ?? ""}
                                                    onChange={(e) => field.onChange(e.currentTarget.value)}
                                                    onBlur={field.onBlur}
                                                    error={(form.formState.errors.selectors?.[idx] as any)?.code?.message}
                                                />
                                            )}
                                        />
                                    </div>

                                    {/* SELECTOR VALUE */}
                                    <div className="col-span-12 md:col-span-6">
                                        <Controller
                                            name={`selectors.${idx}.selectorValue` as const}
                                            control={form.control}
                                            rules={{ required: "Bắt buộc" }}
                                            render={({ field }) => (
                                                <TextInput
                                                    size="xs"
                                                    withAsterisk
                                                    label="Selector Value"
                                                    placeholder="#order-position-container input"
                                                    inputWrapperOrder={["label", "input", "error"]}
                                                    value={field.value ?? ""}
                                                    onChange={(e) => field.onChange(e.currentTarget.value)}
                                                    onBlur={field.onBlur}
                                                    error={(form.formState.errors.selectors?.[idx] as any)?.selectorValue?.message}
                                                />
                                            )}
                                        />
                                    </div>

                                    {/* DESCRIPTION */}
                                    <div className="col-span-12 md:col-span-3">
                                        <Controller
                                            name={`selectors.${idx}.description` as const}
                                            control={form.control}
                                            render={({ field }) => (
                                                <TextInput
                                                    size="xs"
                                                    label="Description"
                                                    placeholder="Mô tả ngắn"
                                                    inputWrapperOrder={["label", "input", "error"]}
                                                    value={field.value ?? ""}
                                                    onChange={(e) => field.onChange(e.currentTarget.value)}
                                                    onBlur={field.onBlur}
                                                    error={(form.formState.errors.selectors?.[idx] as any)?.description?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <ButtonLoading className="w-[80px]" loading={false} type="submit">
                    Save
                </ButtonLoading>
            </form>
        </Form>
    );
}
