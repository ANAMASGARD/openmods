# OpenMods

OpenMods is a Next.js application with Auth0 sign-in, Neon Postgres, and
Trigger.dev chat agents. It is configured to run as one Node.js web service on Render.

See [Project summary](./PROJECT_SUMMARY.md) for completed work, architecture,
verification results, current Git state, and deployment next steps.

## Getting Started

Use Node.js 24 and npm. Install the locked dependencies, then run the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to optimize and load Geist fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Render

The [Render deployment guide](./docs/render-deployment.md) covers GitLab connection,
production secrets, Auth0 URLs, the separate Trigger.dev production deployment,
verification, and recovery. The checked-in `render.yaml` prepares one paid
`0.5c-512mb` web service with one instance and automatic previews disabled.

Render builds with `npm ci --include=dev && npm run build` and starts with
`npm run start:render`. The startup check validates the production environment
before Next.js binds to `0.0.0.0` on Render's `PORT`. `GET /healthz` checks the web
process without contacting Auth0, Neon, Trigger.dev, or OpenAI.

The paid service avoids idle spin-down and currently costs about **$7/month** for
base compute, including idle time. No keep-alive cron is needed. AI usage and
external services are separate, and bandwidth/build overages can add costs.
Configuration in this repository does not mean the app has been deployed.

Run `npm run test:render` to check startup validation and the health endpoint's
Auth0 middleware exclusion without contacting external services.

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
Add these server-only settings to `.env.local` and restart the Trigger.dev worker:

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
runs at 60 seconds by default. The chat agent has a one-hour maximum active run
duration. Its `turnTimeout: "60s"` controls waiting for the next message after
suspension, not the time allowed to generate a reply. A later message starts a
continuation run that restores the saved conversation. The default 30-second idle
window after a turn uses compute; suspended time does not. The SDK, build package,
and development CLI use version 4.8.1.

Sign in once with `npx trigger.dev@4.8.1 login`. Put the project's **development**
secret key in the Git-ignored `.env.local` file:

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
the worker after changing it. Production needs a deployed Trigger.dev worker;
keeping this local process open is not a production deployment. See the
[production setup](./docs/render-deployment.md#deploy-the-triggerdev-worker) for
worker variables and the production key used by Render. Export every
task, use built-in `fetch`, and call `wait.*`, `triggerAndWait`, and
`batchTriggerAndWait` sequentially rather than putting them in `Promise.all`.
