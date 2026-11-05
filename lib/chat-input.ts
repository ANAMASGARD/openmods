import { z } from "zod";
import type { UIMessage } from "ai";

export const CHAT_TEXT_LIMIT = 12000;
export const replyStyles = {
  balanced: { label: "Balanced", instruction: "Give clear, practical answers at an appropriate level of detail." },
  concise: { label: "Concise", instruction: "Keep answers short and direct, while retaining essential details." },
  detailed: { label: "Detailed", instruction: "Explain the reasoning and include useful examples and concrete steps." },
} as const;
export type ReplyStyle = keyof typeof replyStyles;

export const chatIdSchema = z.string().min(1).max(128);
export const chatPreferencesSchema = z.object({
  style: z.enum(["balanced", "concise", "detailed"]).default("balanced"),
});

const incomingMessagesSchema = z.array(z.object({
  id: z.string().min(1).max(128),
  role: z.literal("user"),
  parts: z.array(z.object({ type: z.literal("text"), text: z.string().max(CHAT_TEXT_LIMIT) })).min(1).max(16),
}).refine(({ parts }) => parts.some(({ text }) => text.trim()) &&
  parts.reduce((sum, { text }) => sum + text.length, 0) <= CHAT_TEXT_LIMIT)).max(1);

/** The worker receives only the new user message; history belongs to storage. */
export function validateIncomingMessages(messages: UIMessage[]): UIMessage[] {
  const parsed = incomingMessagesSchema.safeParse(messages);
  if (!parsed.success) throw new Error("Please send a text message within the message limit.");
  return parsed.data;
}
