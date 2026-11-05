"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleIcon, SearchIcon } from "lucide-react";
import { ChatAvatar } from "@/components/chat-avatar";
import { useCreatureMotion } from "@/components/creatures/creature-motion";
import { SidebarChats, type SidebarChat } from "@/components/sidebar-chats";
import { SidebarNewMenu } from "@/components/sidebar-new-menu";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";

export function SidebarWorkspace({ chats, error, account }: { chats: SidebarChat[]; error?: string; account: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { isMobile, setOpenMobile } = useSidebar();
  const { setDialogOpen } = useCreatureMotion();
  const dialogId = useId();

  useEffect(() => {
    setDialogOpen(dialogId, open);
    return () => setDialogOpen(dialogId, false);
  }, [dialogId, open, setDialogOpen]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey) || event.altKey || event.repeat || event.isComposing) return;
      const modal = (event.target as HTMLElement)?.closest?.('[role="dialog"]');
      if (modal && !modal.querySelector('[data-slot="command"]') && modal.getAttribute("data-sidebar") !== "sidebar") return;
      event.preventDefault();
      if (!open && isMobile) setOpenMobile(false);
      setOpen(!open);
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [open, isMobile, setOpenMobile]);

  return (
    <>
      <Sidebar className="dark dashboard-theme">
        <SidebarHeader>
          <div className="flex justify-end pr-10 md:pr-0"><SidebarNewMenu /></div>
          <Button ref={triggerRef} type="button" variant="ghost" aria-label="Search chats" aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="Meta+k Control+k"
            className="h-8 w-full min-w-0 justify-start rounded-lg border border-input bg-transparent px-2.5 py-1 text-base font-normal text-muted-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            onClick={() => { if (isMobile) setOpenMobile(false); setOpen(true); }}>
            <SearchIcon /><span className="flex-1 text-left">Search</span>
            <KbdGroup aria-hidden="true"><Kbd>⌘ / Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>
          </Button>
        </SidebarHeader>
        <SidebarContent>
          {error ? <p role="status" className="p-4 text-sm text-muted-foreground">{error}</p> : <SidebarChats chats={chats} />}
        </SidebarContent>
        <SidebarFooter>{account}</SidebarFooter>
      </Sidebar>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search chats" description="Find a chat by its name or latest message. Select a chat to open it."
        className="dark dashboard-theme top-[min(20vh,8rem)] max-h-[calc(100dvh-2rem)] sm:max-w-lg"
        contentProps={{ initialFocus: inputRef, finalFocus: () => {
          if (triggerRef.current?.getClientRects().length) return triggerRef.current;
          return document.querySelector<HTMLButtonElement>('[data-sidebar="trigger"]');
        } }}>
        <Command filter={(_value, search, keywords) => (keywords ?? []).join(" ").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0}>
          <CommandInput ref={inputRef} placeholder="Search chats…" aria-label="Search chats" />
          <CommandList className="max-h-[min(18rem,55dvh)]">
            <CommandEmpty>{error ?? (chats.length ? "No chats match your search." : "No chats yet. Create a bot to get started.")}</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => (
                <CommandItem key={chat.id} value={chat.id} keywords={[chat.name, chat.preview ?? ""]} onSelect={() => {
                  setOpen(false);
                  setOpenMobile(false);
                  router.push(`/chats/${encodeURIComponent(chat.id)}`);
                }}>
                  {chat.avatar ? <ChatAvatar seed={chat.avatar} alt={`${chat.name} avatar`} className="size-10 shrink-0" /> : <MessageCircleIcon aria-hidden="true" />}
                  <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="truncate">{chat.name}</span><span className="truncate text-xs text-muted-foreground">{chat.preview || "No messages yet"}</span></span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
