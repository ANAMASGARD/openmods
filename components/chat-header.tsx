import { MessageCircleIcon, MonitorIcon } from "lucide-react";
import type { EditableBot } from "@/lib/bot-form-schema";
import { EditBotDialog } from "@/components/dashboard/edit-bot-dialog";
import { ChatAvatar } from "@/components/chat-avatar";
import { Button } from "@/components/ui/button";

type ChatHeaderProps = {
  name: string;
  avatar: string | null;
  bot: EditableBot | null;
};

export function ChatHeader({ name, avatar, bot }: ChatHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b py-3 pr-4 pl-14 md:px-6">
      <h1 aria-label={name} className="min-w-0 flex-1 text-xl font-medium">
        {bot ? (
          <EditBotDialog key={bot.id} bot={bot} trigger={
            <button type="button" aria-label={`Edit ${bot.name}`} title="Edit bot" className="flex max-w-full cursor-pointer items-center gap-3 rounded-lg text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
              <ChatAvatar seed={bot.avatar} animated interactive={false} alt={`${bot.name} avatar`} className="size-10" />
              <span className="min-w-0 truncate" title={name}>{name}</span>
            </button>
          } />
        ) : (
          <span className="flex min-w-0 items-center gap-3">
            {avatar ? <ChatAvatar seed={avatar} animated interactive={false} alt={`${name} avatar`} className="size-10" /> : <MessageCircleIcon aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />}
            <span className="truncate" title={name}>{name}</span>
          </span>
        )}
      </h1>
      <Button type="button" variant="ghost" size="icon-lg" disabled aria-label="Desktop workspace (coming soon)" title="Desktop workspace is coming soon">
        <MonitorIcon aria-hidden="true" className="size-5" />
      </Button>
    </header>
  );
}
