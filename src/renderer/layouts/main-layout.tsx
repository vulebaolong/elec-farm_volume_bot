import Bot from "@/components/bot/bot";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { Header } from "@/components/nav/header";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuthCheck } from "@/hooks/use-auth-check";
import { cn } from "@/lib/utils";
import { TWorkerData } from "@/types/worker.type";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

export const iframeHeight = "800px";

export default function MainLayout() {
    const [isChildView, setIsChildView] = useState(false);
    useAuthCheck();

    useEffect(() => {
        const offIsChildView = window.electron.ipcRenderer.on("bot:isChildView", (data: { isChildView: boolean; uid: number }) => {
            console.log("isChildView", data);
            setIsChildView(data.isChildView);
        });

        return () => {
            offIsChildView?.();
        };
    }, []);

    return (
        <div className="[--header-height:60px]">
            <SidebarProvider defaultOpen={false} className={cn("flex flex-col min-h-0", isChildView ? "h-[500px]" : "h-screen")}>
                <Header />
                <div className="flex flex-1 relative">
                    <AppSidebar className="absolute min-h-0 h-full" />
                    <SidebarInset className="absolute w-full h-full pl-[var(--sidebar-width-icon)] overflow-y-auto">
                        <Outlet />
                        <Separator className="mt-10" />
                        <Bot />
                    </SidebarInset>
                </div>
            </SidebarProvider>
        </div>
    );
}
