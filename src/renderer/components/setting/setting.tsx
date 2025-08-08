"use client";

import { useGetSetting, useUpdateSetting } from "@/api/tanstack/setting.tanstack";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../ui/button";
import { ButtonLoading } from "../ui/button-loading";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";

const FormSchema = z.object({
    maxTotalOpenPO: z.string().min(1, "Không được để trống").regex(/^\d+$/, "Chỉ được nhập chữ số"),

    // maxPOPerToken: z.string().min(1, "Không được để trống").regex(/^\d+$/, "Chỉ được nhập chữ số"),
});

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function Setting({ open, onOpenChange: setOpen }: TProps) {
    const getSetting = useGetSetting();
    const updateSetting = useUpdateSetting();

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            maxTotalOpenPO: "",
        },
    });

    useEffect(() => {
        if (getSetting.data) {
            form.reset({
                maxTotalOpenPO: getSetting.data.maxTotalOpenPO.toString(),
            });
        }
    }, [getSetting.data, form]);

    function onSubmit(data: z.infer<typeof FormSchema>) {
        const payload = {
            maxTotalOpenPO: Number(data.maxTotalOpenPO),
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
                <div className="p-4">
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

                                <FormField
                                    control={form.control}
                                    name="maxTotalOpenPO"
                                    render={({ field }) => (
                                        <FormItem className="h-[75px] content-start gap-1">
                                            <FormLabel className="mb-[3px] text-sm font-medium text-muted-foreground">Maximum position</FormLabel>
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
