import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { getUserChat } from "@/queries/bots";
import { ChatConversation } from "@/components/chat-conversation";
import { ChatHeader } from "@/components/chat-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { loadChatHistory } from "@/app/chats/actions";

type ChatPageProps = { params: Promise<{ chatId: string }> };

async function ChatContent({ params }: ChatPageProps) {
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect("/sign-in");
  const { chatId } = await params;
  let chat;
  let history;
  try {
    chat = await getUserChat(chatId);
    if (chat) history = await loadChatHistory(chatId);
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
        <Alert>
          <AlertTitle>Your chat couldn’t be loaded</AlertTitle>
          <AlertDescription>Please try again in a moment.</AlertDescription>
        </Alert>
        <Button variant="secondary" render={<a href={`/chats/${encodeURIComponent(chatId)}`} />} nativeButton={false}>Try again</Button>
      </div>
    );
  }
  if (!chat) notFound();

  return (
    <>
      <ChatHeader name={chat.name} avatar={chat.avatar} bot={chat.bot} />
      <ChatConversation key={chat.id} chatId={chat.id} name={chat.name} initialMessages={history?.messages ?? []} initialSession={history?.session} />
    </>
  );
}

export default function ChatPage(props: ChatPageProps) {
  return (
    <main className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden">
      <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Spinner aria-label="Loading chat" /></div>}>
        <ChatContent {...props} />
      </Suspense>
    </main>
  );
}
