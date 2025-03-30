import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/ui/base/sidebar";

import { Bell } from "lucide-react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "../app-sidebar/app-sidebar";
import { NavUser } from "../app-sidebar/nav-user";
import { ModeToggle } from "../theme-switcher";
import testData from "@/mocks/testData.json";

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 justify-between items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />

          <div className="flex items-center gap-4">
            <div>
              <ModeToggle />
            </div>
            <div className="flex items-center">
              <button className="relative">
                <Bell className="size-5" />
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary"></span>
                </span>
              </button>
            </div>
            <NavUser user={testData.user} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
