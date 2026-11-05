"use client";

import { useRef } from "react";
import { PlusIcon, SquarePenIcon, UsersIcon } from "lucide-react";
import { CreateBotDialog } from "@/components/dashboard/create-bot-dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function SidebarNewMenu() {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <CreateBotDialog finalFocus={triggerRef} trigger={
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuButton ref={triggerRef} tooltip="Create new" className="h-11 gap-3 rounded-xl text-[15px] group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center [&>svg]:size-5" />} aria-label="Create new">
          <SquarePenIcon /><span className="group-data-[collapsible=icon]:hidden">New bot</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="dark dashboard-theme w-56 max-w-[calc(100vw-2rem)]">
          <DropdownMenuGroup>
            <DropdownMenuItem nativeButton render={<DialogTrigger />}><PlusIcon />Create new bot</DropdownMenuItem>
            <DropdownMenuItem><UsersIcon />Create group chat</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    } />
  );
}
