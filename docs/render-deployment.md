# Deploy OpenMods on Render

This runbook publishes the existing Next.js app as one paid Render Node web
service. Auth0, Neon, and Trigger.dev remain external services. Repository
preparation does not create or deploy cloud resources.

## Service configuration and cost

| Setting | Value |
| --- | --- |
| Runtime | Node.js 24, constrained by `package.json` |
| Compute plan | `0.5c-512mb` (formerly Starter): 0.5 CPU, 512 MB RAM |
| Instances | One; no autoscaling |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm run start:render` |
| Health check path | `/healthz` |
| Preview environments | Disabled |
| Data | Existing Neon database and Trigger.dev transcript storage |

The paid service avoids free-service idle spin-down. It bills while idle: base
compute is currently about **$7/month**, not a per-visit charge. A $50 Render credit
would cover roughly seven months of base compute if it does not expire sooner and
no other charges use it. Check the credit's terms and balance in Render Billing.
AI tokens, Trigger.dev, Neon, and Auth0 have separate usage and billing; Render
bandwidth and build usage can also add charges. [Current pricing](https://render.com/pricing)

No keep-alive cron is needed. Health probes do not query the database or invoke
AI. The Trigger agent retains its 30-second active-idle window, then suspends and
releases compute. It does not bill worker compute throughout days of inactivity.
Provider quotas and billing limits still need to remain valid.

## Production environment

Supply credentials through Render's Environment settings or the Blueprint's
initial secret prompts. Keep them out of source files, logs, and browser bundles.

| Render variable | Value |
| --- | --- |
| `AUTH0_DOMAIN` | Auth0 tenant or configured Auth0 custom domain |
| `AUTH0_CLIENT_ID` | Auth0 Regular Web Application client ID |
| `AUTH0_CLIENT_SECRET` | That application's client secret |
| `AUTH0_SECRET` | A stable 64-character hexadecimal cookie-encryption secret |
| `APP_BASE_URL` | Automatically references this service's `RENDER_EXTERNAL_URL` in the Blueprint |
| `DATABASE_URL` | Existing Neon `postgres://` or `postgresql://` URL, including the database name and recommended TLS settings |
| `TRIGGER_SECRET_KEY` | A Production environment key from the existing Trigger.dev project (`tr_prod_sk_…`) |

Generate a production `AUTH0_SECRET` **once**, save it in Render, and keep it
unchanged across deployments and restarts:

```bash
openssl rand -hex 32
```

Changing it invalidates existing app sessions. The Render web process does not
need `OPENAI_API_KEY` or `OPENAI_CHAT_MODEL`; these belong to the Trigger worker.

The Blueprint uses a supported service self-reference for `APP_BASE_URL`, so the
first deploy receives the actual `https://…onrender.com` origin without guessing
its hostname. For a custom domain, replace that `fromService` block with
`sync: false` in the Blueprint and set the exact HTTPS origin in Render; retain
no path, query, or fragment. Update Auth0's URLs at the same time. Do not merely
override the value in the dashboard while leaving a conflicting Blueprint
reference that a future sync would restore.
[Blueprint environment references](https://render.com/docs/blueprint-spec#self-referencing-environment-variables)

`start:render` validates configuration before starting Next.js. It reports variable
names without values and makes no external requests. It reads the process
environment, not `.env.local`. The normal `dev` and `start` commands are unchanged.
Render supplies `PORT`; Next.js listens on that port and `0.0.0.0`.

`sync: false` variables prompt only during initial Blueprint creation. Add or
change those values on an existing service's Environment page and deploy the
updated environment; later Blueprint syncs do not prompt for them.
[Render environment documentation](https://render.com/docs/configure-environment-variables)

## Deploy the Trigger.dev worker

1. Open the existing project's **Production** environment in Trigger.dev.
2. Set `DATABASE_URL` to the same database used by Render, `OPENAI_API_KEY` to the
   provider key, and optionally `OPENAI_CHAT_MODEL` (default: `gpt-6-luna`). Local
   `.env.local` settings are not automatically uploaded as worker secrets.
3. From the repository root, authenticate the pinned CLI if needed and deploy:

   ```bash
   npx trigger.dev@4.8.1 login
   npx trigger.dev@4.8.1 deploy --env prod --skip-update-check
   ```

4. Wait for a successful deployment. Confirm `openmods-chat` and
   `openmods-healthcheck` appear in Production, then run the healthcheck task from
   that dashboard with `{}`. It does not call OpenAI or access the database.
5. Create or use a Production API key for the app and save it as Render's
   `TRIGGER_SECRET_KEY`. This differs from the development key used locally.

The local `npm run dev:trigger` process is only for development. The Render build
does not deploy Trigger tasks. For releases that change tasks, deploy a compatible
worker version before releasing the web change, using the same source revision.
Render auto-deploys from GitLab do not replace this step.
[Trigger.dev deployment documentation](https://trigger.dev/docs/deployment/overview)

The current `turnTimeout: "60s"` limits waiting for the next message after the
agent suspends; it is not a reply-generation timeout. After the run ends, a new
message can start a continuation run and restore transcript history. The
one-hour `maxDuration` is a separate active-compute limit.

## Create the Render service and configure Auth0

1. Review the changes and publish them to the intended GitLab branch when ready.
   Render must be able to read that branch's `render.yaml`. Do not upload local
   environment files.
2. Connect GitLab under Render Account Settings → Git Deployment Credentials and
   grant access to this repository. GitLab Maintainer or Owner permissions are
   needed for automatic deploys. [Git provider setup](https://render.com/docs/git-provider)
3. Create a **Blueprint** from that repository and branch. Review the one paid
   web service and secret prompts before applying. The Blueprint uses Render's
   default Oregon region; to place the service nearer the existing Neon database,
   set `region` in the Blueprint before first creation.
4. Read the created service's actual HTTPS URL. `APP_BASE_URL` uses that URL through
   the Blueprint self-reference. Do not assume the service name guarantees a
   particular `onrender.com` hostname.
5. In the Auth0 **Regular Web Application**, add these URLs using the real origin:

   | Auth0 setting | Example |
   | --- | --- |
   | Allowed Callback URLs | `https://your-app.onrender.com/auth/callback` |
   | Allowed Logout URLs | `https://your-app.onrender.com` |
   | Allowed Web Origins | `https://your-app.onrender.com` |

   Preserve required localhost development entries. For a custom domain,
   configure its TLS/DNS in Render first, then update the Blueprint,
   `APP_BASE_URL`, and Auth0 entries together.
6. Wait until the specific Render deploy is **Live**, then complete the checks
   below. A successful build or health check does not verify external services.

The app uses standard `next start`. No static export, custom server, or persistent
disk is required. Auth0 cookies, Neon data, and Trigger transcripts survive web
process replacement. Disposable Next.js caches may be rebuilt.
[Next.js on Render](https://render.com/docs/deploy-nextjs-app)

## Verify before sharing the link

Local tests using synthetic Auth0 sessions or mock Trigger responses do not
verify production OAuth or provider access. Check the deployed HTTPS origin:

- Request `/healthz`: expect HTTP 200, `{"status":"ok"}`, `Cache-Control: no-store`,
  and no redirect or session cookie. This reports web-process health, not
  downstream-service readiness.
- Perform real Auth0 sign-in and logout. Confirm redirects return to this
  deployment and session cookies use HTTPS security attributes.
- Create a bot and verify saved values. Confirm another account cannot open its
  chat or start a session as its owner.
- Send a small chat message, verify progressive streaming, then test stop,
  retry, reload, and restored history. This incurs normal provider usage.
- Leave the conversation idle beyond its suspended wait, send another message,
  and confirm context is restored. Revisit after more than 15 minutes without
  activity: the paid web service should not show a spin-up page.
- Restart the web service, then verify the existing browser session, bots, and
  transcript still work without rotating `AUTH0_SECRET`.
- Inspect Render memory, CPU, response time, and errors during dashboard and chat
  use. Local measurements do not prove a 512 MB container has sufficient headroom
  under real traffic. Investigate OOM events or sustained high memory before
  increasing the plan.

## Recovery and spending checks

- **Startup fails:** correct the named variable in Render and redeploy. Do not
  paste secret values into logs or issue reports.
- **Login fails:** compare the actual origin, `APP_BASE_URL`, and Auth0 callback
  and logout settings. Rotating `AUTH0_SECRET` is not a login repair.
- **Data or chat fails while `/healthz` passes:** check Render/Trigger logs,
  Neon access, the production Trigger key and worker deployment, and OpenAI
  quota. Do not add dependency calls to `/healthz`; a provider outage should
  not repeatedly restart an otherwise healthy web process.
- **A release fails:** inspect deploy status and logs. Render normally retains
  the previous healthy version when replacement health checks fail. Roll back a
  bad live release through deployment history, and restore a compatible Trigger
  version if the release also changed tasks.
- **Costs grow:** inspect Render Billing and other providers separately. Keep one
  instance and previews disabled. Check credit expiry before judging begins.
  Keep-alive cron jobs do not make paid hosting bill only for visits.

This preparation does not change database tables. Do not run schema commands on
every build or startup. If a later feature changes a table, follow the project's
development-only `npm run db:push` policy; do not add migrations or backfills.
