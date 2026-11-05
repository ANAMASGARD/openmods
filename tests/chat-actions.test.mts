import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

let owned = true;
const calls: unknown[] = [];
mock.module("../queries/bots.ts", { namedExports: { getUserChat: async (chatId: string) => owned && chatId === "owned-chat" ? { id: chatId } : null } });
mock.module(require.resolve("@trigger.dev/sdk"), { namedExports: { auth: { createPublicToken: async (options: unknown) => { calls.push(options); return "scoped-token"; } } } });
mock.module(require.resolve("@trigger.dev/sdk/ai"), { namedExports: {
  defaultStorage: {},
  chat: {
    createStartSessionAction: () => async (options: unknown) => { calls.push(options); return { publicAccessToken: "scoped-token" }; },
    createLoadTranscriptAction: () => async (options: unknown) => { calls.push(options); return { messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "saved" }] }], cursors: { lastOutEventId: "42" } }; },
  },
} });
const { startChatSession, mintChatAccessToken, loadChatHistory } = await import("../app/chats/actions");

test("start, refresh, and history reject unauthenticated, foreign and invalid chats before contacting Trigger", async () => {
  for (const chatId of ["foreign-chat", "", "x".repeat(129), "owned-chat"]) {
    owned = chatId !== "owned-chat";
    const before = calls.length;
    await assert.rejects(startChatSession({ chatId }));
    await assert.rejects(mintChatAccessToken(chatId));
    await assert.rejects(loadChatHistory(chatId));
    assert.equal(calls.length, before);
  }
});

test("authorized actions pin the task inputs and scope tokens and transcript cursors to the owned chat", async () => {
  owned = true; calls.length = 0;
  await startChatSession({ chatId: "owned-chat", userId: "forged", triggerConfig: { task: "forged" } } as { chatId: string });
  assert.deepEqual(calls[0], { chatId: "owned-chat", clientData: { style: "balanced" } });
  await mintChatAccessToken("owned-chat");
  assert.deepEqual(calls[1], { scopes: { read: { sessions: "owned-chat" }, write: { sessions: "owned-chat" } }, expirationTime: "1h" });
  const history = await loadChatHistory("owned-chat");
  assert.equal(history.messages[0].id, "user-1");
  assert.deepEqual(history.session, { publicAccessToken: "scoped-token", lastEventId: "42" });
});
