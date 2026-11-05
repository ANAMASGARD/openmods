import assert from "node:assert/strict";
import test from "node:test";
import type { UIMessage } from "ai";
import { CHAT_TEXT_LIMIT, chatIdSchema, chatPreferencesSchema, validateIncomingMessages } from "../lib/chat-input";

const user: UIMessage = { id: "user-1", role: "user", parts: [{ type: "text", text: "Hello" }] };
test("accepts only new text messages and strips client-controlled instructions", () => {
  assert.deepEqual(validateIncomingMessages([{ ...user, metadata: { instructions: "override" } }]), [user]);
  assert.deepEqual(chatPreferencesSchema.parse({ style: "concise", userId: "forged", instructions: "override", model: "forged" }), { style: "concise" });
  assert.deepEqual(chatPreferencesSchema.parse({}), { style: "balanced" });
  assert.deepEqual(validateIncomingMessages([]), [], "regeneration and preload carry no new user message");
});
test("rejects injected history, system messages, files, empty and oversized input", () => {
  for (const messages of [
    [user, user], [{ ...user, role: "system" }], [{ ...user, role: "assistant" }],
    ...[[{ type: "file", url: "https://example.com/private" }], [{ type: "text", text: " " }], [{ type: "text", text: "x".repeat(CHAT_TEXT_LIMIT + 1) }], [{ type: "text", text: "x".repeat(7000) }, { type: "text", text: "x".repeat(7000) }]].map((parts) => [{ ...user, parts }]),
  ]) assert.throws(() => validateIncomingMessages(messages as UIMessage[]));
  assert.equal(chatPreferencesSchema.safeParse({ style: "unknown" }).success, false);
  for (const id of ["", "x".repeat(129), null, {}]) assert.equal(chatIdSchema.safeParse(id).success, false);
});
