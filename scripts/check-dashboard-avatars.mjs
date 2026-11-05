import assert from "node:assert/strict";
import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";
import { decrypt } from "../node_modules/@auth0/nextjs-auth0/dist/server/cookies.js";
import { createPreviewContext } from "./creature-preview-session.mjs";

// This intentionally uses local synthetic sessions and the configured development
// database. It does not exercise the real OAuth login provider.
const baseUrl = process.argv[2] ?? "http://127.0.0.1:3001";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const contexts = [];
const owners = [];
const errors = [];
let sql;

async function setup() {
  const context = await createPreviewContext(browser, baseUrl, { viewport: { width: 1280, height: 1024 } });
  contexts.push(context);
  const cookie = (await context.cookies()).find((item) => item.name === "__session");
  const session = await decrypt(cookie.value, process.env.AUTH0_SECRET);
  const owner = session?.payload.user?.sub;
  assert.match(owner, /^creature-preview-[0-9a-f-]{36}$/, "only unique synthetic owners may be used or cleaned up");
  owners.push(owner);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the local creation check.");
  sql ??= neon(process.env.DATABASE_URL);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/dashboard`);
  await page.locator("main [data-creature-selector]").waitFor();
  await page.locator("main [data-renderer-status='ready']").waitFor();
  return { context, page, owner };
}

async function rows(owner) {
  return sql`SELECT id, user_id, name, job, avatar, sandbox_id FROM bots WHERE user_id = ${owner} ORDER BY created_at`;
}

async function openDialog(page) {
  await page.getByRole("button", { name: "Create a new bot", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create your bot", exact: true });
  await dialog.waitFor();
  await dialog.locator("[data-renderer-status='ready']").waitFor();
  assert.equal(await dialog.locator("[data-creature]").count(), 1, "creation keeps a single selected avatar");
  assert.equal(await dialog.locator("[data-creature-selector], [data-diagonal-carousel]").count(), 0, "creation does not repeat avatar selection");
  assert.ok(await dialog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1), "the creation form fits without scrolling");
  const seed = await dialog.locator("input[name='avatar']").inputValue();
  assert.match(seed, /^[A-Za-z0-9_-]{21}$/);
  return { dialog, seed };
}

async function addFields(dialog, values) {
  await dialog.locator("form").evaluate((form, fields) => {
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      input.dataset.testField = "true";
      form.append(input);
    }
  }, values);
}

try {
  const first = await setup();
  const { page, owner } = first;
  assert.equal((await rows(owner)).length, 0);
  const welcome = page.locator("main [data-creature]");
  const welcomeSelector = page.locator("main [data-creature-selector]");
  await welcomeSelector.getByRole("button", { name: "Choose Spark jerboa", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("main [data-selected-creature='spark-jerboa'] [data-renderer-status='ready']"));
  const welcomeVariant = await welcome.getAttribute("data-creature-variant");
  const trigger = page.getByRole("button", { name: "Create a new bot", exact: true });
  let { dialog, seed } = await openDialog(page);
  const firstSeed = seed;
  assert.equal(await dialog.locator("[data-creature]").getAttribute("data-creature"), "spark-jerboa", "welcome choice carries into the creation dialog");
  assert.equal(await dialog.locator("[data-creature]").getAttribute("data-creature-variant"), welcomeVariant, "welcome palette carries into the creation dialog");
  assert.equal(await welcome.getAttribute("data-creature-state"), "paused", "welcome pauses behind the creation dialog");
  assert.equal(await dialog.locator("[data-creature]").getAttribute("data-creature-state"), "idle", "dialog stays animated");
  assert.ok(await dialog.evaluate((element) => element.contains(document.activeElement)), "opening keeps focus inside the dialog");
  await dialog.getByRole("button", { name: "Your new bot’s avatar. Say hello", exact: true }).click();
  assert.equal((await rows(owner)).length, 0, "greeting cannot submit the form");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.ok(await trigger.evaluate((element) => document.activeElement === element), "closing restores trigger focus");
  assert.equal(await welcome.getAttribute("data-creature-state"), "idle");

  await welcomeSelector.getByRole("button", { name: "Choose Cloud bat", exact: true }).click();
  await page.locator("main [data-creature='cloud-bat'][data-renderer-status='ready']").waitFor();
  const nextWelcomeVariant = await welcome.getAttribute("data-creature-variant");
  ({ dialog, seed } = await openDialog(page));
  assert.notEqual(seed, firstSeed, "each dialog opening gets a new seed");
  assert.equal(await dialog.locator("[data-creature]").getAttribute("data-creature"), "cloud-bat", "reopening follows the latest dashboard selection");
  assert.equal(await dialog.locator("[data-creature]").getAttribute("data-creature-variant"), nextWelcomeVariant);
  await dialog.getByLabel("Name", { exact: true }).fill("A name to keep");
  await dialog.getByLabel("What’s their job?", { exact: true }).fill("Check avatar identity");
  await dialog.getByLabel("Instructions (optional)", { exact: true }).fill("Keep these instructions through retries.");
  await dialog.getByRole("button", { name: "Your new bot’s avatar. Say hello", exact: true }).click();
  assert.equal(await dialog.locator("input[name='avatar']").inputValue(), seed, "greeting cannot change the selected identity");
  assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), "A name to keep", "greeting must preserve typed fields");
  assert.equal(await dialog.getByLabel("What’s their job?", { exact: true }).inputValue(), "Check avatar identity");
  const preview = dialog.locator("[data-creature]");
  const identity = {
    species: await preview.getAttribute("data-creature"),
    variant: await preview.getAttribute("data-creature-variant"),
    portrait: await preview.locator("img").getAttribute("src"),
  };
  await dialog.getByLabel("Name", { exact: true }).fill("   ");
  await dialog.getByLabel("What’s their job?", { exact: true }).fill("Check avatar identity");
  await dialog.getByRole("button", { name: "Create bot", exact: true }).click();
  await dialog.getByText("Give your bot a name.", { exact: true }).waitFor();
  assert.equal(await dialog.locator("input[name='avatar']").inputValue(), seed, "server validation must retain the preview seed");
  assert.equal((await rows(owner)).length, 0, "invalid form must not create a row");
  assert.equal(await preview.getAttribute("data-creature"), identity.species);
  assert.equal(await preview.getAttribute("data-creature-variant"), identity.variant);
  assert.equal(await dialog.getByLabel("What’s their job?", { exact: true }).inputValue(), "Check avatar identity", "validation retains the entered job");
  assert.equal(await dialog.getByLabel("Instructions (optional)", { exact: true }).inputValue(), "Keep these instructions through retries.", "validation retains instructions");

  await dialog.getByLabel("Name", { exact: true }).fill("Avatar persistence check");
  await addFields(dialog, { avatar: "invalid", userId: "forged-owner", sandboxId: "forged-sandbox" });
  await dialog.getByRole("button", { name: "Create bot", exact: true }).click();
  await dialog.getByText("We couldn’t verify your bot’s avatar. Please reopen this dialog and try again.", { exact: true }).waitFor();
  assert.equal((await rows(owner)).length, 0, "ambiguous avatar input cannot create a row");
  await dialog.locator("[data-test-field='true']").evaluateAll((inputs) => inputs.forEach((input) => input.remove()));
  assert.equal(await dialog.locator("input[name='avatar']").inputValue(), seed, "failed retry keeps the original seed");
  let releaseSubmission;
  const submissionGate = new Promise((resolve) => { releaseSubmission = resolve; });
  await page.route("**/dashboard", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) await submissionGate;
    await route.continue();
  });
  try {
    await dialog.getByRole("button", { name: "Create bot", exact: true }).click();
    await dialog.locator("form[aria-busy='true']").waitFor();
    const fields = dialog.locator("input:not([type='hidden']), textarea, button[type='submit']");
    assert.ok(await fields.evaluateAll((controls) => controls.every((control) => control.disabled)), "form editing is locked while submission is pending");
    assert.equal(await dialog.locator("input[name='avatar']").inputValue(), seed);
    assert.equal(await preview.getAttribute("data-creature"), identity.species);
  } finally {
    releaseSubmission();
  }
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("heading", { name: "Your bots", exact: true }).waitFor();
  const saved = await rows(owner);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].avatar, seed, "database must persist the exact preview seed");
  assert.equal(saved[0].user_id, owner);
  assert.equal(saved[0].sandbox_id, null);
  const portrait = page.getByRole("img", { name: "Avatar persistence check avatar", exact: true });
  assert.equal(await portrait.getAttribute("data-creature"), identity.species);
  assert.equal(await portrait.getAttribute("data-creature-variant"), identity.variant);
  assert.equal(await portrait.getAttribute("src"), identity.portrait);
  assert.ok(await portrait.evaluate((image) => image.complete && image.naturalWidth > 0));
  assert.equal(await page.locator("canvas").count(), 0, "saved cards must use portraits only");
  await page.reload();
  await portrait.waitFor();
  assert.equal(await portrait.getAttribute("src"), identity.portrait, "reload must preserve the saved identity");
  assert.equal(await page.locator("canvas").count(), 0);

  const second = await setup();
  assert.equal(await second.page.getByRole("heading", { name: "Avatar persistence check", exact: true }).count(), 0, "another session cannot see the first owner's bot");
  const other = await openDialog(second.page);
  await other.dialog.getByLabel("Name", { exact: true }).fill("Ownership boundary check");
  await other.dialog.getByLabel("What’s their job?", { exact: true }).fill("Verify session-scoped creation");
  await addFields(other.dialog, { userId: owner, id: saved[0].id, sandboxId: "forged-sandbox", createdAt: "2000-01-01" });
  await other.dialog.getByRole("button", { name: "Create bot", exact: true }).click();
  await other.dialog.waitFor({ state: "hidden" });
  const secondSaved = await rows(second.owner);
  assert.equal(secondSaved.length, 1);
  assert.equal(secondSaved[0].avatar, other.seed);
  assert.equal(secondSaved[0].user_id, second.owner, "ownership must come from the session");
  assert.equal(secondSaved[0].sandbox_id, null, "protected fields must not be mass assigned");
  assert.notEqual(secondSaved[0].id, saved[0].id);
  assert.deepEqual(await rows(owner), saved, "a forged owner must not alter the other user's row");

  const expired = await openDialog(second.page);
  await expired.dialog.getByLabel("Name", { exact: true }).fill("Must not be saved");
  await expired.dialog.getByLabel("What’s their job?", { exact: true }).fill("Check session expiry");
  await second.context.clearCookies();
  await expired.dialog.getByRole("button", { name: "Create bot", exact: true }).click();
  await second.page.waitForURL((url) => url.pathname === "/sign-in");
  assert.equal((await rows(second.owner)).length, 1, "submission without a session cannot create a bot");
  assert.deepEqual(errors, [], "unexpected browser errors");
  console.log("Dashboard avatar checks passed: compact single-avatar dialog, dashboard-to-dialog identity, retained form fields, pending lock, validation retries, ownership isolation, and portrait-only cards.");
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  if (sql) {
    for (const owner of owners) {
      assert.match(owner, /^creature-preview-[0-9a-f-]{36}$/);
      await sql`DELETE FROM bots WHERE user_id = ${owner}`;
    }
  }
}
