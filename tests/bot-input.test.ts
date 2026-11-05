import assert from "node:assert/strict";
import test from "node:test";
import { AVATAR_SEED_LENGTH, BOT_LIMITS, parseBotInput } from "../lib/bot-input";

const avatar = "aB0_-".repeat(4) + "Z";

function form(values: Record<string, string>) {
  const data = new FormData();
  data.set("avatar", avatar);
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

test("trims input and accepts omitted instructions without accepting ownership fields", () => {
  const result = parseBotInput(form({ name: " Atlas ", job: " Research ", userId: "another-user", sandboxId: "external", id: "forged-id", createdAt: "yesterday", avatarUrl: "https://example.com/other-avatar" }));
  assert.equal(result.valid, true);
  assert.deepEqual(result.values, { name: "Atlas", job: "Research", instructions: "", avatar });
});

test("rejects missing and whitespace-only required fields", () => {
  for (const data of [form({}), form({ name: "  ", job: "\n" })]) {
    const result = parseBotInput(data);
    assert.equal(result.valid, false);
    assert(result.errors.name);
    assert(result.errors.job);
  }
});

test("enforces every length limit while accepting its boundary", () => {
  for (const [field, max] of Object.entries(BOT_LIMITS)) {
    assert.equal(parseBotInput(form({ name: "Atlas", job: "Research", [field]: "x".repeat(max) })).valid, true);
    assert.equal(parseBotInput(form({ name: "Atlas", job: "Research", [field]: "x".repeat(max + 1) })).valid, false);
  }
});

test("rejects file values rather than coercing them to text", () => {
  for (const field of [...Object.keys(BOT_LIMITS), "avatar"]) {
    const data = form({ name: "Atlas", job: "Research" });
    data.set(field, new File(["data"], "value.txt"));
    const result = parseBotInput(data);
    assert.equal(result.valid, false);
    assert(result.errors[field as keyof typeof result.errors]);
  }
});

test("preserves a valid preview seed exactly", () => {
  const result = parseBotInput(form({ name: "Atlas", job: "Research", avatar }));
  assert.equal(avatar.length, AVATAR_SEED_LENGTH);
  assert.equal(result.valid, true);
  assert.equal(result.values.avatar, avatar);
});

test("rejects absent, malformed, or whitespace-padded preview seeds", () => {
  const missing = form({ name: "Atlas", job: "Research" });
  missing.delete("avatar");
  assert.equal(parseBotInput(missing).valid, false);
  assert(parseBotInput(missing).errors.avatar);

  for (const invalid of [
    "",
    "x".repeat(AVATAR_SEED_LENGTH - 1),
    "x".repeat(AVATAR_SEED_LENGTH + 1),
    ` ${avatar}`,
    `${avatar} `,
    "x".repeat(AVATAR_SEED_LENGTH - 1) + "\n",
    "x".repeat(AVATAR_SEED_LENGTH - 1) + "/",
    "é".repeat(AVATAR_SEED_LENGTH),
  ]) {
    const result = parseBotInput(form({ name: "Atlas", job: "Research", avatar: invalid }));
    assert.equal(result.valid, false, `Should reject ${JSON.stringify(invalid)}`);
    assert(result.errors.avatar);
    assert.equal(result.values.avatar, "");
  }
});

test("rejects duplicate avatar fields instead of choosing an ambiguous identity", () => {
  const data = form({ name: "Atlas", job: "Research" });
  data.append("avatar", "x".repeat(AVATAR_SEED_LENGTH));
  const result = parseBotInput(data);
  assert.equal(result.valid, false);
  assert(result.errors.avatar);
});
