import { TVersions } from "@/types/version.type";
import { VisuallyHidden } from "@mantine/core";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import Version from "./version";
import { useAppSelector } from "@/redux/store";

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function DialogInfo({ open, onOpenChange }: TProps) {
    const ver = useAppSelector((state) => state.bot.versions);

    useEffect(() => {
        if (!ver?.current || !ver?.latest) return;
        if (ver.latest && ver.latest !== ver.current) {
            onOpenChange(true);
        }
    }, [ver?.current, ver?.latest]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <form>
                <DialogContent className="sm:max-w-[425px] [&>button[data-slot='dialog-close']]:hidden" aria-describedby={undefined}>
                    <VisuallyHidden>
                        <DialogTitle>Thông tin ứng dụng</DialogTitle>
                    </VisuallyHidden>
                    {ver?.current && <Version current={ver?.current} latest={ver?.latest} />}
                    {/* <div className="flex flex-col items-center gap-2">
                        <p className="text-sm text-muted-foreground">Version: {ver.current}</p>
                        {ver.latest && ver.latest !== ver.current && <p className="text-sm text-green-500">New available: {ver.latest}</p>}
                        <Badge variant="outline">{IS_PRODUCTION ? "Production" : "Development"}</Badge>
                    </div> */}
                </DialogContent>
            </form>
        </Dialog>
    );
}
