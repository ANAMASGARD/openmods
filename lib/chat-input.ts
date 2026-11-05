import { z } from "zod";

export const CHAT_TEXT_LIMIT = 12000;
export const replyStyles = {
  balanced: { label: "Balanced", instruction: "Give clear, practical answers at an appropriate level of detail." },
  concise: { label: "Concise", instruction: "Keep answers short and direct, while retaining essential details." },
  detailed: { label: "Detailed", instruction: "Explain the reasoning and include useful examples and concrete steps." },
} as const;
export type ReplyStyle = keyof typeof replyStyles;

export const chatRequestSchema = z.object({
  chatId: z.string().min(1).max(128),
  style: z.enum(["balanced", "concise", "detailed"]).default("balanced"),
  messages: z.array(z.object({
    id: z.string().min(1).max(128),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.union([
      z.object({ type: z.literal("text"), text: z.string().max(64000) }),
      z.object({ type: z.literal("step-start") }),
    ])).max(16),
  })).min(1).max(100),
}).refine(({ messages }) => messages.at(-1)?.role === "user", { message: "End with a user message." })
  .refine(({ messages }) => messages.every((message) => message.role === "assistant" || (
    message.parts.some((part) => part.type === "text" && part.text.trim()) &&
    message.parts.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 0), 0) <= CHAT_TEXT_LIMIT
  )), { message: "User messages must contain text within the message limit." })
  .refine(({ messages }) => messages.reduce((total, message) => total + message.parts.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 0), 0), 0) <= 100000, { message: "Conversation is too long." })
  // A response stopped before its first token can leave an empty assistant turn.
  .transform((input) => ({ ...input, messages: input.messages.filter((message) => message.parts.some((part) => part.type === "text" && part.text.trim())) }));
