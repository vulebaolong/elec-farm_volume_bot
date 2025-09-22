import * as React from 'react';

import { NavMain } from '@/components/nav/nav-main';
import { NavUser } from '@/components/nav/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export function AppSidebar({ className,...props }: React.ComponentProps<typeof Sidebar>) {
  const { open } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className={cn("absolute", className)}
    >
      <SidebarHeader className={'items-center'}>
        <div
          className={cn(
            'flex justify-between align-center w-full transition-all duration-200 ease-linear',
            'group-data-[collapsible=icon]:justify-center',
          )}
        >
          <p
            className={cn(
              'text-sidebar-foreground/70 opacity-100 visible w-full ring-sidebar-ring flex h-8 items-center rounded-md text-xs font-medium transition-all duration-200 ease-linear overflow-hidden whitespace-nowrap',
              'px-2',
              'group-data-[collapsible=icon]:px-0',
              'group-data-[collapsible=icon]:w-0',
              'group-data-[collapsible=icon]:opacity-0',
              'group-data-[collapsible=icon]:invisible',
            )}
          >
            Menu
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger />
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              <p>{open ? 'Close Sidebar' : 'Open Sidebar'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
