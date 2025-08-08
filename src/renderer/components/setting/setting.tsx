"use client";

import { useGetSetting, useUpdateSetting } from "@/api/tanstack/setting.tanstack";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../ui/button";
import { ButtonLoading } from "../ui/button-loading";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";
import { STOP_LOSS, TAKE_PROFIT } from "@/constant/app.constant";

const FormSchema = z.object({
    // maxPOPerToken: z.string().min(1, "Không được để trống").regex(/^\d+$/, "Chỉ được nhập chữ số"),
    maxTotalOpenPO: z.string().min(1, "Maximum Position required").regex(/^\d+$/, "Type number only"),
    leverage: z.string().min(1, "Levera required").regex(/^\d+$/, "Type number only"),
    inputUSDT: z.string().min(1, "Input USDT required").regex(/^\d+$/, "Type number only"),
});

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Setting({ open, onOpenChange: setOpen }: TProps) {
    const getSetting = useGetSetting();
    const updateSetting = useUpdateSetting();
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Khi vào trang, nếu đang focus vào input nào đó thì bỏ focus
        const el = document.activeElement as HTMLElement | null;
        if (el && el !== document.body) el.blur();
    }, []);

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            maxTotalOpenPO: "",
            leverage: "",
            inputUSDT: "",
        },
    });

    useEffect(() => {
        if (getSetting.data) {
            form.reset({
                maxTotalOpenPO: getSetting.data.maxTotalOpenPO.toString(),
                leverage: getSetting.data.leverage.toString(),
                inputUSDT: getSetting.data.inputUSDT.toString(),
            });
        }
    }, [getSetting.data, form]);

    function onSubmit(data: z.infer<typeof FormSchema>) {
        const payload = {
            maxTotalOpenPO: Number(data.maxTotalOpenPO),
            leverage: Number(data.leverage),
            inputUSDT: Number(data.inputUSDT),
        };
        updateSetting.mutate(payload, {
            onSuccess: () => {
                toast.success(`Update Setting Successfully`);
            },
        });
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Setting</SheetTitle>
                </SheetHeader>
                <div className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Take Profit:</p>
                        <p className="font-bold">{TAKE_PROFIT}%</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Stop Loss:</p>
                        <p className="font-bold">{STOP_LOSS}%</p>
                    </div>

                    {/* from */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} id={"setting"}>
                            <div className="grid gap-2">
                                {/* <FormField
                                    control={form.control}
                                    name="maxPOPerToken"
                                    render={({ field }) => (
                                        <FormItem className="h-[75px] content-start gap-1">
                                            <FormLabel className="mb-[3px] text-sm font-medium text-muted-foreground">PO tối đa 1 pair</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    inputMode="numeric" // mobile keyboard số
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    onKeyDown={(e) => {
                                                        const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
                                                        if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
                                                            e.preventDefault(); // chặn ký tự không hợp lệ
                                                        }
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage className="leading-none text-xs" />
                                        </FormItem>
                                    )}
                                /> */}

                                {/* maxTotalOpenPO */}
                                <FormField
                                    control={form.control}
                                    name="maxTotalOpenPO"
                                    render={({ field }) => (
                                        <FormItem className="h-[75px] content-start gap-1">
                                            <FormLabel className="mb-[3px] text-sm font-medium text-muted-foreground">Maximum Position</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    onKeyDown={(e) => {
                                                        const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
                                                        if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
                                                            e.preventDefault(); // chặn ký tự không hợp lệ
                                                        }
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage className="leading-none text-xs" />
                                        </FormItem>
                                    )}
                                />

                                {/* Leverage */}
                                <FormField
                                    control={form.control}
                                    name="leverage"
                                    render={({ field }) => (
                                        <FormItem className="h-[75px] content-start gap-1">
                                            <FormLabel className="mb-[3px] text-sm font-medium text-muted-foreground">Leverage</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    onKeyDown={(e) => {
                                                        const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
                                                        if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
                                                            e.preventDefault(); // chặn ký tự không hợp lệ
                                                        }
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage className="leading-none text-xs" />
                                        </FormItem>
                                    )}
                                />

                                {/* input USDT */}
                                <FormField
                                    control={form.control}
                                    name="inputUSDT"
                                    render={({ field }) => (
                                        <FormItem className="h-[75px] content-start gap-1">
                                            <FormLabel className="mb-[3px] text-sm font-medium text-muted-foreground">Input USDT</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    onKeyDown={(e) => {
                                                        const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
                                                        if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
                                                            e.preventDefault(); // chặn ký tự không hợp lệ
                                                        }
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage className="leading-none text-xs" />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </form>
                    </Form>
                </div>
                <SheetFooter>
                    <ButtonLoading loading={updateSetting.isPending} type="submit" form="setting">
                        Save changes
                    </ButtonLoading>
                    <SheetClose asChild>
                        <Button variant="outline">Close</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
