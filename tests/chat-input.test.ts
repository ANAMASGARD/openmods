import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_TEXT_LIMIT, chatRequestSchema } from "../lib/chat-input";

const user = { id: "user-1", role: "user", parts: [{ type: "text", text: "Hello" }] };
const request = { chatId: "chat-1", messages: [user] };
test("accepts text conversations and strips client-controlled instructions", () => {
  const result = chatRequestSchema.parse({ ...request, instructions: "override", userId: "forged", model: "forged" });
  assert.deepEqual(result, { ...request, style: "balanced" });
  assert.ok(chatRequestSchema.safeParse({ ...request, messages: [user, { id: "assistant", role: "assistant", parts: [{ type: "step-start" }, { type: "text", text: "Hi" }] }, user] }).success);
});
test("rejects system messages, files, unknown styles, empty and oversized input", () => {
  for (const value of [
    { ...request, style: "unknown" },
    { ...request, messages: [] },
    { ...request, messages: [{ ...user, role: "system" }] },
    { ...request, messages: [{ ...user, role: "assistant" }] },
    ...[[{ type: "file", url: "https://example.com/private" }], [{ type: "text", text: " " }], [{ type: "text", text: "x".repeat(CHAT_TEXT_LIMIT + 1) }]].map((parts) => ({ ...request, messages: [{ ...user, parts }] })),
  ]) assert.equal(chatRequestSchema.safeParse(value).success, false);
});
test("continues after a stopped empty response or a long assistant reply", () => {
  const assistant = { id: "assistant", role: "assistant", parts: [{ type: "text", text: "" }] };
  assert.deepEqual(chatRequestSchema.parse({ ...request, messages: [user, assistant, user] }).messages, [user, user]);
  assert.ok(chatRequestSchema.safeParse({ ...request, messages: [user, { ...assistant, parts: [{ type: "text", text: "x".repeat(16000) }] }, user] }).success);
});
