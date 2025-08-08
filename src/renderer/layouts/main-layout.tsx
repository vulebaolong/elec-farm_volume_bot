// src/layouts/MainLayout.tsx
import { AppSidebar } from '@/components/nav/app-sidebar';
import { Header } from '@/components/nav/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useAuthCheck } from '@/hooks/use-auth-check';
import { Outlet } from 'react-router-dom';

export const iframeHeight = '800px';
export const description = 'A sidebar with a header and a search form.';

export default function MainLayout() {
  useAuthCheck();
  return (
    <div className="[--header-height:60px]">
      <SidebarProvider defaultOpen={false} className="flex flex-col">
        <Header />
        <div className="flex flex-1 relative">
          <AppSidebar />
          <SidebarInset className="absolute w-full h-full pl-[var(--sidebar-width-icon)]">
            <Outlet />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
