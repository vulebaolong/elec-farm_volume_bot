"use client";

import { ClipboardList, CodeXml, House, Info, Palette, Settings, Users } from "lucide-react";

import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { ROUTER } from "@/constant/router.constant";
import { navigateTo } from "@/helpers/navigate.helper";
import { useAppSelector } from "@/redux/store";
import { useState } from "react";
import DialogInfo from "../dialog/dialog-info";
import ThemeToggleV2 from "../theme-toggle/theme-toggle-v2";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function NavMain() {
    const { isMobile, state } = useSidebar();
    const [openAbout, setOpenAbout] = useState(false);
    const info = useAppSelector((state) => state.user.info);

    const scrollToTop = () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
            });
        });
    };

    // 🧩 định nghĩa menu cơ bản
    const menuConfig = [
        {
            key: "home",
            label: "Home",
            icon: House,
            onClick: () => {
                navigateTo(ROUTER.HOME);
                scrollToTop();
            },
            roles: ["admin", "dev"],
        },
        {
            key: "theme",
            label: "Theme",
            icon: Palette,
            custom: (
                <div className="flex items-center overflow-hidden">
                    <div className="p-2">
                        <Palette className="size-4 shrink-0" />
                    </div>
                    <span className="text-sm">Theme</span>
                    <ThemeToggleV2 className="ml-auto" />
                </div>
            ),
            roles: ["user", "admin", "dev"],
        },
        {
            key: "usersManager",
            label: "Users Manager",
            icon: Users,
            onClick: () => {
                navigateTo(ROUTER.USER_MANAGER);
                scrollToTop();
            },
            roles: ["admin", "dev"],
        },
        {
            key: "listManager",
            label: "List Manager",
            icon: ClipboardList,
            onClick: () => {
                navigateTo(ROUTER.LIST_MANAGER);
                scrollToTop();
            },
            roles: ["admin", "dev"],
        },
        {
            key: "setting",
            label: "Setting",
            icon: Settings,
            onClick: () => {
                navigateTo(ROUTER.SETTING);
                scrollToTop();
            },
            roles: ["admin", "dev"],
        },

        {
            key: "settingDev",
            label: "Setting Dev",
            icon: CodeXml,
            onClick: () => {
                navigateTo(ROUTER.SETTING_DEV);
                scrollToTop();
            },
            roles: ["dev"],
        },
        {
            key: "about",
            label: "About",
            icon: Info,
            onClick: () => setOpenAbout(true),
            roles: ["user", "admin", "dev"],
        },
    ];

    // 🎯 xác định role
    const roleId = info?.Roles?.id;
    const currentRole = roleId === 3 ? "dev" : roleId === 1 ? "admin" : "user";

    // 🧠 lọc menu theo role
    const visibleMenu = menuConfig.filter((item) => item.roles.includes(currentRole));

    return (
        <>
            <SidebarGroup>
                <SidebarMenu>
                    {visibleMenu.map((item) => {
                        const Icon = item.icon;
                        return (
                            <SidebarMenuItem key={item.key}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        {item.custom ? (
                                            item.custom
                                        ) : (
                                            <SidebarMenuButton onClick={item.onClick} className="flex items-center overflow-hidden">
                                                {Icon && <Icon className="size-4 shrink-0" />}
                                                <span className="text-sm">{item.label}</span>
                                            </SidebarMenuButton>
                                        )}
                                    </TooltipTrigger>
                                    <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                                        <p>{item.label}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroup>

            <DialogInfo open={openAbout} onOpenChange={setOpenAbout} />
        </>
    );
}
