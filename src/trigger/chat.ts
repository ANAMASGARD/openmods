import { openai } from "@ai-sdk/openai";
import { chat, defaultStorage } from "@trigger.dev/sdk/ai";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { bots, chatMembers, chats } from "../../lib/db/schema";
import { chatPreferencesSchema, replyStyles, validateIncomingMessages } from "../../lib/chat-input";

export const openmodsChat = chat.agent({
  id: "openmods-chat",
  storage: defaultStorage,
  clientDataSchema: chatPreferencesSchema,
  maxDuration: 3600,
  turnTimeout: "60s",
  onValidateMessages: ({ messages }) => validateIncomingMessages(messages),
  uiMessageStreamOptions: {
    sendReasoning: false,
    onError: () => "Couldn’t finish the reply. Please try again.",
  },
  run: async ({ chatId, messages, clientData, signal, streamText }) => {
    if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
      throw new Error("Chat is not available yet. Please try again later.");
    }
    // The session's chatId is authorized by our server actions. Never take bot
    // instructions, ownership, or a model selection from browser clientData.
    const db = drizzle(process.env.DATABASE_URL);
    const [record] = await db.select({
      name: chats.name, botName: bots.name, job: bots.job, instructions: bots.instructions,
    }).from(chats)
      .leftJoin(chatMembers, eq(chatMembers.chatId, chats.id))
      .leftJoin(bots, and(eq(bots.id, chatMembers.botId), eq(bots.userId, chats.userId)))
      .where(eq(chats.id, chatId))
      .orderBy(asc(chatMembers.joinedAt), asc(chatMembers.botId)).limit(1);
    if (!record) throw new Error("Chat not found.");
    return streamText({
      model: openai(process.env.OPENAI_CHAT_MODEL || "gpt-6-luna"),
      instructions: [
        `You are ${record.botName ?? record.name ?? "a helpful AI assistant"}, a helpful AI assistant.`,
        record.job ? `Your role: ${record.job}.` : "",
        record.instructions ?? "",
        "You can discuss, explain, and draft work. You do not have connected tools and cannot execute tasks or access external accounts.",
        replyStyles[clientData?.style ?? "balanced"].instruction,
      ].filter(Boolean).join("\n\n"),
      messages,
      maxOutputTokens: 4096,
      abortSignal: signal,
    });
  },
});
