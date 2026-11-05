"use client";

import { useRef } from "react";
import { PlusIcon, UsersIcon } from "lucide-react";
import { CreateBotDialog } from "@/components/dashboard/create-bot-dialog";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function SidebarNewMenu() {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <CreateBotDialog finalFocus={triggerRef} trigger={
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" ref={triggerRef} />} aria-label="Create new">
          <PlusIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="dark dashboard-theme w-56 max-w-[calc(100vw-2rem)]">
          <DropdownMenuGroup>
            <DropdownMenuItem nativeButton render={<DialogTrigger />}><PlusIcon />Create new bot</DropdownMenuItem>
            <DropdownMenuItem><UsersIcon />Create group chat</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    } />
  );
}
