import { AppSidebar } from "@/components/app-sidebar";
import { CreatureMotionProvider } from "@/components/creatures/creature-motion";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <CreatureMotionProvider>
        <SidebarProvider className="dark dashboard-theme bg-background text-foreground">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center px-4">
              <SidebarTrigger />
            </header>
            {children}
          </div>
        </SidebarProvider>
      </CreatureMotionProvider>
    </TooltipProvider>
  );
}
