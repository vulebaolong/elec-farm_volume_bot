import Bot from "@/components/bot/bot";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { Header } from "@/components/nav/header";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { roleAllowed } from "@/helpers/function.helper";
import { useAuthCheck } from "@/hooks/use-auth-check";
import { cn } from "@/lib/utils";
import { SET_IS_CHILD_VIEW } from "@/redux/slices/bot.slice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";

export const iframeHeight = "800px";

export default function MainLayout() {
    useAuthCheck();
    const dispatch = useAppDispatch();
    const isChildView = useAppSelector((state) => state.bot.isChildView);
    const info = useAppSelector((state) => state.user.info);

    useEffect(() => {
        const offIsChildView = window.electron.ipcRenderer.on("bot:isChildView", (data: { isChildView: boolean }) => {
            console.log("isChildView", data);
            dispatch(SET_IS_CHILD_VIEW(data.isChildView));
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
                        {roleAllowed(info?.roleId) && (
                            <>
                                <Outlet />
                                <Separator className="mt-10" />
                            </>
                        )}
                        <Bot />
                    </SidebarInset>
                </div>
            </SidebarProvider>
        </div>
    );
}
