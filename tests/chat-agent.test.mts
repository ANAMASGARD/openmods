import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createRequire } from "node:module";
import { MockLanguageModelV3 } from "ai/test";
import { simulateReadableStream, type UIMessage } from "ai";
const require = createRequire(import.meta.url);
const { mockChatAgent } = require("@trigger.dev/sdk/ai/test") as typeof import("@trigger.dev/sdk/ai/test");
let failing = false;
let slow = false;
let modelStarted: (() => void) | undefined;
let modelSignal: AbortSignal | undefined;
const prompts: unknown[] = [];
const model = new MockLanguageModelV3({ doStream: async (options) => {
  prompts.push(options.prompt);
  if (slow) {
    modelSignal = options.abortSignal;
    modelStarted?.();
    return { stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: "text-start", id: "slow" });
      options.abortSignal?.addEventListener("abort", () => controller.error(new DOMException("Stopped", "AbortError")), { once: true });
    } }) };
  }
  if (failing) throw new Error("private-provider-error");
  return { stream: simulateReadableStream({ chunks: [
    { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "A saved reply" }, { type: "text-end", id: "t" },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 2, noCache: 2, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 3, text: 3, reasoning: undefined } } },
  ] }) };
} });
mock.module(require.resolve("@ai-sdk/openai"), { namedExports: { openai: () => model } });
const bot = { id: 'bot-1', name: 'Atlas', avatar: 'atlas', job: 'Developer', instructions: 'Server-owned instructions', sandboxId: 'sandbox-1' };
mock.module(require.resolve('../lib/chat-context'), { namedExports: {
  getChatContext: async () => ({ row: { userId: 'owner', kind: 'direct' }, bot, members: [bot] }),
  botIdentity: (value: typeof bot) => ({ id: value.id, name: value.name, avatar: value.avatar }),
} });
mock.module(require.resolve('../lib/runtime-db'), { namedExports: { runtimeDb: () => {
  const query = { from: () => query, where: async () => [{ userId: 'owner' }], set: () => query };
  return { select: () => query, update: () => query };
} } });
mock.module(require.resolve('../lib/usage'), { namedExports: { recordAiUsage: async () => {} } });
process.env.DATABASE_URL = "mock-database";
process.env.OPENAI_API_KEY = "mock-key";
const { openmodsChat } = await import("../src/trigger/chat");
const user = (id: string, text: string): UIMessage => ({ id, role: "user", parts: [{ type: "text", text }] });

test("agent streams, persists, resumes context and regenerates without duplicating questions", { timeout: 20000 }, async () => {
  let harness = mockChatAgent(openmodsChat, { chatId: "chat-a", clientData: { style: "concise", instructions: "forged" } });
  try {
    const first = await harness.sendMessage(user("u1", "Remember this question"));
    assert.ok(first.chunks.some(c => c.type === "text-delta" && c.delta === "A saved reply"));
    await harness.close();
    const snapshot = harness.getSnapshot();
    assert.ok(snapshot);
    assert.equal(snapshot.messages.length, 2);
    assert.match(JSON.stringify(prompts[0]), /Server-owned instructions/);
    assert.match(JSON.stringify(prompts[0]), /Keep answers short/);
    assert.doesNotMatch(JSON.stringify(prompts[0]), /forged/);
    harness = mockChatAgent(openmodsChat, { chatId: "chat-a", clientData: { style: "balanced" }, snapshot, continuation: true });
    await harness.sendMessage(user("u2", "What did I ask?"));
    assert.match(JSON.stringify(prompts.at(-1)), /Remember this question/);
    await harness.sendRegenerate();
    await harness.close();
    assert.equal(harness.getSnapshot()?.messages.filter(e => e.message.role === "user").length, 2);
    assert.equal(harness.getSnapshot()?.messages.length, 4);
  } finally { await harness.close(); }
});

test("fresh chat is isolated and failure can be retried with a sanitized UI error", { timeout: 20000 }, async () => {
  const harness = mockChatAgent(openmodsChat, { chatId: "chat-b", clientData: { style: "balanced" } });
  try {
    failing = true;
    const turn = await harness.sendMessage(user("u3", "Retry me"));
    assert.doesNotMatch(JSON.stringify(prompts.at(-1)), /Remember this question/);
    assert.doesNotMatch(JSON.stringify(turn.chunks), /private-provider-error/);
    failing = false;
    const retry = await harness.sendRegenerate();
    assert.ok(retry.chunks.some(c => c.type === "text-delta"));
  } finally { failing = false; await harness.close(); }
});


test("stopping aborts the provider and keeps the user message", { timeout: 20000 }, async () => {
  const harness = mockChatAgent(openmodsChat, { chatId: "chat-stop", clientData: { style: "balanced" } });
  try {
    slow = true;
    const started = new Promise<void>(resolve => { modelStarted = resolve; });
    const turn = harness.sendMessage(user("stop-user", "A slow question"));
    await started;
    await harness.sendStop();
    await turn;
    assert.equal(modelSignal?.aborted, true);
    await harness.close();
    assert.ok(harness.getSnapshot()?.messages.some(e => e.id === "stop-user"));
  } finally { slow = false; modelStarted = undefined; await harness.close(); }
});
