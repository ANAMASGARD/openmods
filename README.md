This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

See [Project summary](./PROJECT_SUMMARY.md) for completed work, architecture,
verification results, current Git state, and deployment next steps.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Persistent sign-in

Auth0 manages accounts; the Next.js SDK remembers the app session in an encrypted,
HttpOnly cookie. `lib/auth-session.ts` enables rolling sessions with no absolute
cutoff and a 400-day inactivity window. Each visit renews that window. The installed
SDK uses the finite inactivity duration when calculating the encrypted cookie's expiry,
even though the configured absolute duration is `Infinity`.
This behavior is covered by SDK regression tests because an unlimited absolute
duration is not explicitly documented by Auth0.

Chrome [caps persistent cookies at 400 days](https://developer.chrome.com/blog/cookie-max-age-expires).
Browser privacy settings can clear cookies sooner. Logout or clearing site data
ends the browser session. Signed-in visitors to `/sign-in` and `/sign-up` go directly
to `/dashboard`.

For local development, keep `AUTH0_SECRET` unchanged in `.env.local` and consistently
use `http://localhost:3000`, matching `APP_BASE_URL`. `127.0.0.1` has a separate cookie
store. HTTPS deployments automatically receive Secure cookies. Auth0's own SSO
session and API access-token lifetimes are separate from this app-session policy.

- `npm run test:auth` checks real SDK renewal, invalid-cookie rejection, and security attributes without contacting Auth0.
- With the dev server running, `npm run test:auth:browser` checks a full browser restart, auth-page redirects, and local logout using a disposable browser profile and synthetic localhost session. It does not test external OAuth/SSO.

## Database

Neon Postgres is connected with Drizzle's HTTP driver. Keep `DATABASE_URL` in
`.env.local` (ignored by Git). Never prefix it with `NEXT_PUBLIC_`.

- `npm run db:check` runs a read-only connectivity query through Drizzle.
- Define tables in `lib/db/schema.ts`.
- `npm run db:push` applies the schema directly to the development database.
- Treat development data as disposable; do not generate migrations or backfill rows.
- `npm run db:studio` opens Drizzle Studio locally.

Server Components and server-side code can import `getDb` from `@/lib/db`.
The `bots` table stores an indexed Auth0 user ID, name, avatar seed, job,
optional instructions and sandbox ID, and a creation timestamp. Auth0 remains
the authentication provider; external user and sandbox IDs have no local foreign keys.

Drizzle generates Nano IDs for `id` and `avatar` when omitted during inserts.
These are application defaults, so raw SQL inserts must supply both values.
Postgres supplies `created_at` with `now()` when omitted.

## AI chat

Chat pages use AI SDK 7, AI Elements, and the `openmods-chat` Trigger.dev agent.
Add these server-only settings to `.env.local` and restart the dev server:

```dotenv
OPENAI_API_KEY=your-openai-api-key
# Optional; defaults to gpt-6-luna.
OPENAI_CHAT_MODEL=gpt-6-luna
```

Server actions authenticate with Auth0 and check chat ownership before starting a
session, refreshing a scoped token, or loading history. The worker loads the bot’s
saved job and instructions from the database. Trigger.dev’s default transcript
storage persists messages by chat ID and restores history and the streaming cursor
on reload. No database schema change is needed. No agent tools or file uploads are enabled.
The existing microphone control uses browser speech recognition.

The composer supports Enter to send, Shift+Enter for a new line, response styles,
starter prompts, stopping generation, and retrying failed replies. API keys are
never sent to the browser. `npm run test:chat:browser` uses synthetic local Auth0
sessions and a mock Trigger.dev backend; it does not make a paid OpenAI request.
Stop the regular Next.js dev server first: the browser check starts and stops its
own local Next.js instance. `npm run test:chat` checks authorization, message
validation, and the agent’s persistence, regeneration, error, and stop behavior.

## Background tasks with Trigger.dev

The project is linked to `proj_yyokorioekbldyziwkwb`. Tasks live in `src/trigger/`
and use `@trigger.dev/sdk`. `trigger.config.ts` selects Node.js 24 and caps task
runs at 60 seconds by default. The chat agent allows a one-hour run with a
60-second per-turn timeout. The SDK, build package, and development CLI use
version 4.8.1.

Sign in once with `npx trigger.dev@latest login`. Put the project's **development**
secret key in the Git-ignored `.env` file:

```dotenv
TRIGGER_SECRET_KEY=your-development-secret-key
```

Run the background worker in a separate terminal alongside `npm run dev`:

```bash
npm run dev:trigger
```

Once the worker is ready, select `openmods-healthcheck` in the Trigger.dev dashboard's
Development environment and run it with an empty payload (`{}`). The task logs
worker readiness and returns `{ "status": "ok", "message": "Trigger.dev is running in OpenMods." }`.
It does not access the database or call external APIs. You can also run it from a
second terminal and wait for the result:

```bash
npx trigger.dev@4.8.1 tasks trigger openmods-healthcheck --env dev --wait --timeout 60
```

Keep the development worker running to execute development tasks. The chat worker
also needs `DATABASE_URL`, `OPENAI_API_KEY`, and optionally `OPENAI_CHAT_MODEL`.
`npm run dev:trigger` loads `.env.local`, including `OPENAI_CHAT_MODEL`; restart
the worker after changing it. Configure the same server-only variables in Trigger.dev for deployment. Export every
task, use built-in `fetch`, and call `wait.*`, `triggerAndWait`, and
`batchTriggerAndWait` sequentially rather than putting them in `Promise.all`.
