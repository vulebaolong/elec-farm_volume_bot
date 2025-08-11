import { IS_PRODUCTION } from "@/constant/app.constant";
import packageJson from "../../../../package.json";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { useEffect, useState } from "react";
import { VisuallyHidden } from "@mantine/core";

type TProps = {
    open: boolean;
    onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
};

type Versions = { current: string; latest: string | null };
export default function DialogInfo({ open, onOpenChange }: TProps) {
    const [ver, setVer] = useState<Versions>({ current: "", latest: null });

    useEffect(() => {
        window.electron.ipcRenderer.invoke("app:get-versions").then((v: Versions) => {
            setVer(v);
            if (v.latest && v.latest !== v.current) {
                // Nếu có version mới => mở dialog
                onOpenChange(true);
            }
        });
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <form>
                <DialogContent className="sm:max-w-[425px] [&>button[data-slot='dialog-close']]:hidden" aria-describedby={undefined}>
                    <VisuallyHidden>
                        <DialogTitle>Thông tin ứng dụng</DialogTitle>
                    </VisuallyHidden>
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-sm text-muted-foreground">Version: {ver.current}</p>
                        {ver.latest && ver.latest !== ver.current && <p className="text-sm text-green-500">New available: {ver.latest}</p>}
                        <Badge variant="outline">{IS_PRODUCTION ? "Production" : "Development"}</Badge>
                    </div>
                </DialogContent>
            </form>
        </Dialog>
    );
}
