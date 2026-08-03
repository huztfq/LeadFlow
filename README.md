# Leadflow

A single-operator lead-gen and cold-email tool: chat with Claude in **Studio** to design lead
filters and email sequences, approve once, then enrich Apollo contacts and run campaigns via Resend.

## Stack

- Next.js (App Router) + React
- Claude (Anthropic) via Vercel AI SDK for Studio planning
- Prisma 7 + PostgreSQL (Supabase)
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
   | `ANTHROPIC_API_KEY` | Claude API key for Studio chat + plan design. |
   | `APOLLO_API_KEY` | Apollo.io API key, used for people search/import. |
   | `RESEND_API_KEY` | Resend API key, used to send campaign emails. |
   | `RESEND_FROM_EMAIL` | Verified Resend sender, e.g. `"Leadflow <you@yourdomain.com>"`. |
   | `APP_PASSWORD` | The owner's login password. Use a long, random value. First successful login bootstraps an `owner` User row — see [Team, invites & credit limits](#team-invites--credit-limits). |
   | `OWNER_EMAIL` | Optional email for the bootstrap owner row (defaults to `owner@leadflow.local`). |
   | `UNSUBSCRIBE_SECRET` | HMAC secret for signed unsubscribe links. Must be different from `APP_PASSWORD` — unsubscribe links are mailed to recipients, so reusing the login password would let anyone brute-force it offline. Falls back to `APP_PASSWORD` if unset, but only for local dev. |
   | `CRON_SECRET` | Bearer token the cron worker must present to `/api/cron/send`. Generate any random string. |
   | `APP_URL` | Public base URL of the app (used to build unsubscribe links). `http://localhost:3000` for local dev. |
   | `RESEND_WEBHOOK_SECRET` | Signing secret for the Resend webhook (Inbox open/click/bounce tracking). Optional locally; see [Inbox, stats & AI categorization](#inbox-stats--ai-categorization). |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Optional Google Calendar OAuth credentials for the Calendar page. See [Calendar](#calendar). |
   | `GOOGLE_LOGIN_REDIRECT_URI` | Optional — enables the "Sign in with Google" button on `/login` (reuses `GOOGLE_CLIENT_ID`/`SECRET` above, just needs this extra redirect URI registered on the same OAuth client). Invite-only — see [Login, waitlist & Google sign-in](#login-waitlist--google-sign-in). |

2. **Create the database schema in Supabase.** Open the Supabase SQL Editor for your project and
   run, in order: [`prisma/sql/001_init.sql`](prisma/sql/001_init.sql),
   [`prisma/sql/002_chat_sessions.sql`](prisma/sql/002_chat_sessions.sql) (Studio chat history),
   [`prisma/sql/003_inbox_calendar.sql`](prisma/sql/003_inbox_calendar.sql) (Inbox, reply
   tracking, and Calendar tables), [`prisma/sql/004_users_invites.sql`](prisma/sql/004_users_invites.sql)
   (`User`/`Invite` tables for team invites + credit limits), then
   [`prisma/sql/005_waitlist.sql`](prisma/sql/005_waitlist.sql) (`WaitlistSignup` table for the
   login page's waitlist form). These are plain SQL files rather than Prisma migrations, so no
   separate `prisma migrate` step is needed — just run each file once, in order, whenever a new one
   is added.

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

- `src/app/api/*` — route handlers (auth, leads/import, campaigns, cron send, unsubscribe,
  Studio chat + chat session history, Inbox, Calendar, Resend webhook)
- `src/lib/*` — pure/unit-tested business logic (sequencing, merge fields, CSV, Apollo/Resend
  clients, auth, unsubscribe signing, chat session helpers, inbox categorization, calendar/iCal/
  Google helpers)
- `prisma/schema.prisma` — data model
- `prisma/sql/001_init.sql` — hand-run SQL to provision the initial schema in Supabase
- `prisma/sql/002_chat_sessions.sql` — hand-run SQL adding the `ChatSession` table used by
  Studio's chat history sidebar
- `prisma/sql/003_inbox_calendar.sql` — hand-run SQL adding `InboxMessage`, `CalendarConnection`,
  `CalendarEvent`, and open/click/reply/bounce tracking columns on `SendLog`
- `prisma/sql/004_users_invites.sql` — hand-run SQL adding `User` and `Invite` tables for
  multi-user login, invites, and per-user Apollo/AI credit limits

## Inbox, stats & AI categorization

The **Inbox** page (`/inbox`) shows replies to campaign sends plus a stats strip: sent, opened,
replied, interested, booked, and not interested.

- **Data model:** `InboxMessage` stores each reply (matched to a `Lead`/`Enrollment`/`Campaign` by
  email address when possible), with an AI-assigned `category` — one of `interested`,
  `not_interested`, `booked`, `question`, `ooo`, `unsubscribe`, `other` — plus a confidence score.
  `SendLog` gained `openedAt`/`openCount`/`clickedAt`/`repliedAt`/`bouncedAt` so the stats strip can
  report opens/replies without a separate events table.
- **AI categorization:** `src/lib/inbox-category.ts` calls Claude (same `ANTHROPIC_API_KEY` /
  `ANTHROPIC_MODEL` as Studio) with a structured-output schema to classify each reply. If
  `ANTHROPIC_API_KEY` isn't set (or the call fails), it falls back to a deterministic keyword
  heuristic (`guessCategoryHeuristic`, unit-tested) so the Inbox still works without an AI key.
  You can always **manually override** a message's category from its expanded row in the UI.
- **Wiring the Resend webhook (opens/clicks/bounces):** In the Resend dashboard, go to
  **Webhooks → Add endpoint**, point it at `${APP_URL}/api/webhooks/resend`, and subscribe to
  `email.opened`, `email.clicked`, and `email.bounced` at minimum. Copy the endpoint's **signing
  secret** into `RESEND_WEBHOOK_SECRET`. Open tracking must also be enabled on your sending domain
  (Domain page → Tracking) for `email.opened` events to fire at all.
- **Limitation — inbound replies:** Resend is a sending-only API today; it has no inbound-email
  (reply) webhook (`email.replied` doesn't exist). So real replies can't be ingested automatically
  without adding a separate receiving path (e.g. a receiving domain + inbound-parse webhook, or a
  Cloudflare Email Worker) that forwards a normalized payload through `ingestReply()` in
  `src/lib/reply-ingest.ts`. Until then, use the **Simulate a reply** button on the Inbox page
  (`POST /api/inbox/simulate-reply`, session-gated) to exercise the full pipeline — matching,
  categorization, and stats — against a real imported lead.

## Calendar

The **Calendar** page (`/calendar`) lets you connect a calendar and see upcoming events, and lets
"booked" Inbox replies add a placeholder event with one click.

- **Connect options**, in order of how much setup they need:
  1. **Booking link** — paste a Calendly/Cal.com link; it's just surfaced as an "Open booking
     link" button (no event list, since booking-link providers don't expose one without their own
     API/OAuth).
  2. **iCal feed** — paste a calendar's secret iCal URL (in Google Calendar: **Settings → your
     calendar → "Secret address in iCal format"**). `src/lib/ical.ts` has a small dependency-free
     RFC 5545 parser (unit-tested) that reads `VEVENT`s from the feed — no OAuth needed, works
     immediately.
  3. **Google Calendar OAuth** (read-only) — set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
     `GOOGLE_REDIRECT_URI` (an OAuth "Web application" client from Google Cloud Console, with the
     Calendar API enabled and `GOOGLE_REDIRECT_URI` added as an authorized redirect URI), then
     click **Connect Google Calendar**. Tokens are stored on the single `CalendarConnection` row
     and refreshed automatically when they expire.
- **Data model:** `CalendarConnection` is a singleton row (`id: "main"`) holding whichever
  connection is active. `CalendarEvent` stores locally-created events — today, only the
  placeholder created by "Add to calendar" on a `booked` Inbox reply — which are merged into the
  agenda alongside whatever the active connection returns live.
- **Limitation:** this is read/display only — there's no write-back to Google Calendar (creating a
  real Google event from a "booked" reply), and iCal feeds are polled live on each page load rather
  than cached. Recurring events (`RRULE`) in iCal feeds aren't expanded.

## Team, invites & credit limits

Leadflow starts single-operator and evolves into a small team without breaking the original
`APP_PASSWORD` flow:

- **Bootstrap owner:** the first successful `APP_PASSWORD` login creates (or promotes) a `User`
  row with `role: "owner"` — email from `OWNER_EMAIL` if set, else `owner@leadflow.local`. Every
  login after that signs the session cookie (`leadflow_session`) to that user's id, so
  `requireSession`/middleware gating keeps working unchanged while `getCurrentUser`/`requireOwner`
  (in `src/lib/auth.ts`) give routes the actual signed-in user.
- **Inviting teammates:** the owner-only **Team** page (`/settings/team`) has an "Invite a
  teammate" form — email + optional Apollo/AI credit limits (blank = unlimited). This calls
  `POST /api/team/invites`, which creates an `Invite` row (7-day expiry) and tries to email the
  accept link via Resend (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`); the link is **always** also shown
  copyable in the UI as a fallback, since Resend sandbox domains can only mail the account owner.
- **Accepting an invite:** the link is `/invite/[token]` (public — allow-listed in
  `src/proxy.ts`). The invitee sets a password there (`POST /api/invites/[token]/accept`,
  hashed with Node's built-in `crypto.scrypt` — see `src/lib/password.ts`, no extra dependency),
  which creates their `User` row (`role: "member"`) with the limits from the invite and signs them
  in immediately. They can also skip straight to Google sign-in instead — see
  [Login, waitlist & Google sign-in](#login-waitlist--google-sign-in).
- **Member sign-in:** the login page is a single email + password form that posts to
  `/api/auth/login` — see [Login, waitlist & Google sign-in](#login-waitlist--google-sign-in) for
  how that one form also covers the `APP_PASSWORD` admin bypass.
- **Limits & usage:** every user sees their own Apollo/AI credit limit + usage on `/settings/team`
  (`GET /api/team/me`) and as a compact chip in the sidebar (`MyCreditsChip`, next to the existing
  `ApolloUsageBadge` — that badge shows the *shared Apollo account's* real remaining credits;
  `MyCreditsChip` shows *this user's* app-tracked allocation). The owner additionally sees a full
  members table (edit limits inline via `PATCH /api/team/users/[id]`) and pending invites (rescind
  via `DELETE /api/team/invites/[id]`) on the same page.
- **Enforcement:** a `null` limit means unlimited (the owner defaults to unlimited). Otherwise:
  - Apollo: `POST /api/apollo/search` and `POST /api/apollo/enrich-import` (and the Studio
    **Approve & start** flow, `POST /api/assistant/execute`) 403 with a clear message once
    `apolloCreditsUsed >= apolloCreditLimit`; usage increments by the number of people actually
    enriched (Apollo's own billable unit), not raw search hits.
  - AI: `POST /api/assistant/chat` and `POST /api/assistant/execute` 403 the same way once
    `aiCreditsUsed >= aiCreditLimit`; v1 increments by a flat `+1` per request (not token-metered)
    — see `consumeAiCredits`/`consumeApolloCredits` in `src/lib/team.ts`.

## Login, waitlist & Google sign-in

`/login` is one email + password form (plus a Google button) — no separate "app password" vs
"email" tabs:

- **Admin bypass:** `POST /api/auth/login` checks the submitted password against `APP_PASSWORD`
  *first*. If it matches, the request signs in as the bootstrap admin (`ensureOwnerUser`, same as
  before) **regardless of what email was typed** — `APP_PASSWORD` is a master key, not tied to any
  one address, and the email field can even be left blank. Anything else falls through to a normal
  `{ email, password }` lookup against an invited teammate's `User.passwordHash`.
- **No role labels in the UI:** `owner`/`member` still exist on `User.role` for permission checks
  (`requireOwner` in `src/lib/auth.ts` gates Team/Domain-style settings), but nothing in the app
  renders the words "owner"/"member"/"admin" — Team settings just shows people by email.
- **Admin credits:** the admin account has `apolloCreditLimit`/`aiCreditLimit` left `null`
  (unlimited) by `ensureOwnerUser`, and the Team page never offers to edit them. It still sees the
  real shared Apollo account's remaining credits via the existing `ApolloUsageBadge` /
  `GET /api/apollo/usage` (unchanged); the per-user "AI credits" row on `/settings/team` is hidden
  entirely for the admin instead of showing a limit that doesn't apply.
- **Sign up is waitlist-only:** there's no self-serve account creation. The "Sign up" control shows
  a note that sign-up is invite-only during the private beta and opens the same waitlist form as
  the "Join the waitlist" button.
- **Waitlist:** `POST /api/waitlist` (public) takes `{ name, email, useCase }`, validates them, and
  upserts a `WaitlistSignup` row by email (see `prisma/sql/005_waitlist.sql`) — no account or
  session is created. The login page just shows a confirmation that someone will follow up.
- **Google sign-in is invite-only:** clicking "Continue with Google" hits `GET
  /api/auth/google/connect`, which redirects to Google (identity scope only — `openid email
  profile`, no calendar access) using its own `GOOGLE_LOGIN_REDIRECT_URI` so it never collides with
  the Calendar page's separate Google OAuth connection (different redirect URI *and* scope; both
  can share one `GOOGLE_CLIENT_ID`/`SECRET` since a Google OAuth client supports multiple
  registered redirect URIs). `GET /api/auth/google/callback` (`src/lib/google-login.ts`) then:
  - signs straight in if the Google account's email matches an existing `User`;
  - otherwise auto-accepts a still-pending, unexpired `Invite` for that email (creates the `User`
    row with no password set, same limits as the invite) and signs in;
  - otherwise redirects back to `/login?googleError=not_invited`, which the page renders as a
    clear "that Google account isn't invited — join the waitlist instead" message.
  If `GOOGLE_LOGIN_REDIRECT_URI` isn't set, the button still renders (never a dead click) and
  redirects to `/login?googleError=not_configured` instead of attempting a broken OAuth flow.

## Studio chat history

The Studio sidebar's **Recent** list persists every chat as a `ChatSession` row (title, pinned
flag, the full AI SDK message transcript, and the latest drafted/edited outreach plan — all as
Json columns, so no separate messages table is needed). Sessions are created lazily on the first
turn of a new chat and autosaved a moment after the chat or the plan canvas settles.

- **Open a chat:** click a row in Recent (`/assistant?session=<id>`), or **New chat** for a blank
  session.
- **Right-click a row** (or tap the ⋯ button) for **Pin** (keeps it at the top of Recent),
  **Fork and start new** (duplicates the transcript + plan into a new session and opens it), and
  **Delete**.
- API routes (all session-gated via the existing `APP_PASSWORD` cookie):
  `GET/POST /api/assistant/sessions`, `GET/PATCH/DELETE /api/assistant/sessions/[id]`, and
  `POST /api/assistant/sessions/[id]/fork`.
