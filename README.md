This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
