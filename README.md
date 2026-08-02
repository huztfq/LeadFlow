# Leadflow

A single-operator lead-gen and cold-email tool: search and import leads from Apollo, manage a lead
library, build multi-step email campaigns, and let a cron worker send/retry/track them via Resend.

## Stack

- Next.js (App Router) + React
- Prisma 7 + PostgreSQL (built and tested against Supabase)
- Resend for outbound email
- Vercel Cron for the send worker
- Vitest for unit tests

## Local setup

1. **Copy the env file and fill it in:**

   ```bash
   cp .env.example .env
   ```

   | Variable | What it's for |
   | --- | --- |
   | `DATABASE_URL` | Supabase Postgres connection string (Project Settings → Database → Connection string). Use the direct connection for migrations; pooled/transaction mode is fine for the running app. |
   | `APOLLO_API_KEY` | Apollo.io API key, used for people search/import. |
   | `RESEND_API_KEY` | Resend API key, used to send campaign emails. |
   | `RESEND_FROM_EMAIL` | Verified Resend sender, e.g. `"Leadflow <you@yourdomain.com>"`. |
   | `APP_PASSWORD` | The single login password for this app. Use a long, random value. |
   | `UNSUBSCRIBE_SECRET` | HMAC secret for signed unsubscribe links. Must be different from `APP_PASSWORD` — unsubscribe links are mailed to recipients, so reusing the login password would let anyone brute-force it offline. Falls back to `APP_PASSWORD` if unset, but only for local dev. |
   | `CRON_SECRET` | Bearer token the cron worker must present to `/api/cron/send`. Generate any random string. |
   | `APP_URL` | Public base URL of the app (used to build unsubscribe links). `http://localhost:3000` for local dev. |

2. **Create the database schema in Supabase.** Open the Supabase SQL Editor for your project and
   run the contents of [`prisma/sql/001_init.sql`](prisma/sql/001_init.sql). (This is a plain SQL
   file rather than a Prisma migration, so no separate `prisma migrate` step is needed.)

3. **Install dependencies and generate the Prisma client:**

   ```bash
   npm install
   npx prisma generate
   ```

4. **Run the dev server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and log in with `APP_PASSWORD`.

## Testing

```bash
npm test
```

## Deploying to Vercel

1. Import the repo into Vercel and set all the environment variables above in the project's
   **Settings → Environment Variables** (for Production, and Preview if you want previews to work
   too). `DATABASE_URL` in particular must be set for the build — `npm run build` runs
   `prisma generate` first, which needs it to resolve the datasource.
2. Deploy. The build script (`prisma generate && next build`) regenerates the Prisma client on
   every build, since the generated client isn't committed to the repo.
3. **Cron:** [`vercel.json`](vercel.json) schedules `/api/cron/send` every 5 minutes. Vercel Cron
   calls it with an `Authorization: Bearer $CRON_SECRET` header automatically as long as
   `CRON_SECRET` is set in the project's environment variables — no extra configuration needed.
4. The cron route sets `maxDuration = 60` and processes a small batch (10 enrollments) per
   invocation, leasing each row (pushing `nextSendAt` forward) before sending so overlapping or
   retried invocations don't double-send the same email.

## Project structure

- `src/app/api/*` — route handlers (auth, leads/import, campaigns, cron send, unsubscribe)
- `src/lib/*` — pure/unit-tested business logic (sequencing, merge fields, CSV, Apollo/Resend
  clients, auth, unsubscribe signing)
- `prisma/schema.prisma` — data model
- `prisma/sql/001_init.sql` — hand-run SQL to provision the schema in Supabase
