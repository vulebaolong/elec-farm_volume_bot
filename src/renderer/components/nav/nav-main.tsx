"use client";

import { BadgeDollarSign, CodeXml, House, Info, Palette, Settings } from "lucide-react";

import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { navigateTo } from "@/helpers/navigate.helper";
import { useAppSelector } from "@/redux/store";
import { useState } from "react";
import DialogInfo from "../dialog/dialog-info";
import Symbols from "../symbols/symbols";
import ThemeToggleV2 from "../theme-toggle/theme-toggle-v2";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ROUTER } from "@/constant/router.constant";

export function NavMain() {
    const { isMobile, state } = useSidebar();
    const [openSymbol, setOpenSymbol] = useState(false);
    const [openSetting, setOpenSetting] = useState(false);
    const [openAbout, setOpenAbout] = useState(false);
    const info = useAppSelector((state) => state.user.info);

    const srollToTop = () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
            });
        });
    };

    return (
        <>
            <SidebarGroup>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <SidebarMenuButton
                                    onClick={() => {
                                        navigateTo(ROUTER.HOME);
                                        srollToTop();
                                    }}
                                    className="flex items-center overflow-hidden"
                                >
                                    <House className="size-4 shrink-0 " />
                                    <span className="text-sm">Home</span>
                                </SidebarMenuButton>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                                <p>Home</p>
                            </TooltipContent>
                        </Tooltip>
                    </SidebarMenuItem>

                    {/* theme */}
                    <SidebarMenuItem>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center overflow-hidden">
                                    <div className="p-2">
                                        <Palette className="size-4 shrink-0 " />
                                    </div>
                                    <span className="text-sm">Theme</span>
                                    <ThemeToggleV2 className="ml-auto" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                                <p>Theme</p>
                            </TooltipContent>
                        </Tooltip>
                    </SidebarMenuItem>

                    {/* whitelist */}
                    <SidebarMenuItem>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <SidebarMenuButton onClick={() => setOpenSymbol(true)} className="flex items-center overflow-hidden">
                                    <BadgeDollarSign className="size-4 shrink-0 " />
                                    <span className="text-sm">White List</span>
                                </SidebarMenuButton>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                                <p>White List</p>
                            </TooltipContent>
                        </Tooltip>
                    </SidebarMenuItem>

                    {/* setting - amin */}
                    {(info?.Roles?.id === 3 || info?.Roles?.id === 1) && (
                        <SidebarMenuItem>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <SidebarMenuButton
                                        onClick={() => {
                                            navigateTo(ROUTER.SETTING);
                                            srollToTop();
                                        }}
                                        className="flex items-center overflow-hidden"
                                    >
                                        <Settings className="size-4 shrink-0 " />
                                        <span className="text-sm">Setting</span>
                                    </SidebarMenuButton>
                                </TooltipTrigger>
                                <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                                    <p>Setting</p>
                                </TooltipContent>
                            </Tooltip>
                        </SidebarMenuItem>
                    )}

                    {info?.Roles?.id === 3 && (
                        <SidebarMenuItem>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <SidebarMenuButton
                                        onClick={() => {
                                            navigateTo(ROUTER.SETTING_DEV);
                                            srollToTop();
                                        }}
                                        className="flex items-center overflow-hidden"
                                    >
                                        <CodeXml className="size-4 shrink-0 " />
                                        <span className="text-sm">Setting Dev</span>
                                    </SidebarMenuButton>
                                </TooltipTrigger>
                                <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                                    <p>Setting Dev</p>
                                </TooltipContent>
                            </Tooltip>
                        </SidebarMenuItem>
                    )}

                    {/* about */}
                    <SidebarMenuItem>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <SidebarMenuButton onClick={() => setOpenAbout(true)} className="flex items-center overflow-hidden">
                                    <Info className="size-4 shrink-0 " />
                                    <span className="text-sm">About</span>
                                </SidebarMenuButton>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                                <p>About</p>
                            </TooltipContent>
                        </Tooltip>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>

            <Symbols open={openSymbol} onOpenChange={setOpenSymbol} />
            <DialogInfo open={openAbout} onOpenChange={setOpenAbout} />
        </>
    );
}
