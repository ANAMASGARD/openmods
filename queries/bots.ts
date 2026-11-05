import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { auth0 } from "@/lib/auth0";
import { getDb } from "@/lib/db";
import { bots, chatMembers, chats } from "@/lib/db/schema";

/** The owner always comes from the server session, never caller input. */
export async function getUserChats() {
  const session = await auth0.getSession();
  if (!session?.user.sub) return [];
  const owner = session.user.sub;
  const rows = await getDb().select({
    id: chats.id,
    kind: chats.kind,
    name: chats.name,
    preview: chats.lastMessagePreview,
    lastMessageAt: chats.lastMessageAt,
    botName: bots.name,
    avatar: bots.avatar,
  }).from(chats)
    .leftJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    // Guard member data too, even if an invalid cross-owner membership exists.
    .leftJoin(bots, and(eq(bots.id, chatMembers.botId), eq(bots.userId, owner)))
    .where(eq(chats.userId, owner))
    .orderBy(desc(chats.lastMessageAt), desc(chats.id), asc(chatMembers.joinedAt), asc(chatMembers.botId));

  const unique = new Map<string, {
    id: string; name: string; avatar: string | null; preview: string | null; lastMessageAt: Date;
  }>();
  for (const row of rows) {
    const previous = unique.get(row.id);
    if (previous?.avatar || (previous && !row.avatar)) continue;
    unique.set(row.id, {
      id: row.id,
      name: row.kind === "group" ? row.name || row.botName || "Group chat" : row.botName || "New chat",
      avatar: row.avatar,
      preview: row.preview,
      lastMessageAt: row.lastMessageAt,
    });
  }
  return [...unique.values()];
}
