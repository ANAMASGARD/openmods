import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { auth0 } from "@/lib/auth0";
import { chatRequestSchema, replyStyles } from "@/lib/chat-input";
import { getUserChat } from "@/queries/bots";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth0.getSession();
  if (!session?.user.sub) return new Response("Please sign in to continue.", { status: 401 });
  let input;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 256000) return new Response("Conversation is too large.", { status: 413 });
    input = chatRequestSchema.safeParse(JSON.parse(raw));
  } catch {
    return new Response("Invalid chat request.", { status: 400 });
  }
  if (!input.success) return new Response("Invalid chat request.", { status: 400 });
  try {
    const chat = await getUserChat(input.data.chatId);
    if (!chat) return new Response("Chat not found.", { status: 404 });
    if (!process.env.OPENAI_API_KEY) return new Response("Chat is not available yet. Please try again later.", { status: 503 });
    const result = streamText({
      model: openai(process.env.OPENAI_CHAT_MODEL || "gpt-6.1-sol"),
      instructions: [
        `You are ${chat.bot?.name ?? chat.name}, a helpful AI assistant.`,
        chat.bot?.job ? `Your role: ${chat.bot.job}.` : "",
        chat.bot?.instructions ?? "",
        "You can discuss, explain, and draft work. You do not have connected tools and cannot execute tasks or access external accounts.",
        replyStyles[input.data.style].instruction,
      ].filter(Boolean).join("\n\n"),
      messages: await convertToModelMessages(input.data.messages),
      maxOutputTokens: 4096,
      abortSignal: request.signal,
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream, sendReasoning: false, onError: () => "Couldn’t finish the reply. Please try again." }),
    });
  } catch {
    return new Response("Couldn’t start the reply. Please try again.", { status: 500 });
  }
}
