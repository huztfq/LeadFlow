# Leadflow Design Spec

**Date:** 2026-08-02  
**Status:** Approved for planning  
**Project:** Personal standalone app (`leadflow`)

## Goal

Import leads from Apollo with open industry/keyword filters, store them locally, export CSV, and run multi-step email sequences via Resend.

## Product decisions

| Decision | Choice |
|---|---|
| Scope | New app / new repo (not Zoie) |
| Lead storage | In-app Postgres + CSV export |
| Outreach | In-app campaigns + Resend sending |
| Sequences | Multi-step (e.g. Day 0 / Day 3 / Day 7) in v1 |
| Industry filters | Fully open (any Apollo industry/keyword; no fixed presets) |
| Auth (v1) | Single-user app password / session cookie |
| Hosting shape | Next.js on Vercel + Supabase Postgres + Vercel Cron |
| Separate backend | No — Next.js API routes + cron on Vercel are the backend |

## Architecture

**Stack:** Next.js (App Router) on Vercel + Prisma + Supabase Postgres + Apollo API + Resend + Vercel Cron

**High-level flow:**

1. **Search** — server-side Apollo people search with open filters (industry, keywords, titles, location, etc.)
2. **Import** — selected people saved as leads; dedupe by email (primary) or Apollo ID
3. **Library** — browse/filter leads, CSV export, select for campaigns
4. **Campaigns** — define sequence steps (subject/body + delay days), enroll leads, activate
5. **Send worker** — cron finds due enrollments, sends via Resend, logs status, advances steps

**Secrets:** `APOLLO_API_KEY`, `RESEND_API_KEY`, `DATABASE_URL`, `APP_PASSWORD`, `CRON_SECRET` live in server env only. Never expose to the client.

```
Browser → Next.js API routes → Apollo / Prisma / Resend
                ↑
         Vercel Cron (secured by CRON_SECRET)
```

## Screens (v1)

1. **Login** — app password gate
2. **Search & Import** — open Apollo filters → results table → multi-select → Import
3. **Leads** — library with filters, multi-select, CSV export, “Add to campaign”
4. **Campaigns** — list + create/edit sequence steps
5. **Campaign detail** — enrollments, send progress, pause/resume

## Data model

### Lead

- `id`, `apolloId` (nullable unique), `email` (nullable unique when present)
- `firstName`, `lastName`, `title`, `company`, `industry`, `location`, `phone` (nullable)
- `rawJson` (Apollo payload snapshot)
- `importedAt`, `updatedAt`

Dedupe on import: match by `email` first, else `apolloId`. Skip leads with no email and report count.

### Campaign

- `id`, `name`
- `status`: `draft` | `active` | `paused` | `completed`
- `createdAt`, `updatedAt`

### SequenceStep

- `id`, `campaignId`, `stepOrder` (0-based)
- `delayDays` (days after previous send; step 0 uses 0 = send ASAP on enroll)
- `subject`, `bodyHtml`
- Support merge fields: `{{firstName}}`, `{{lastName}}`, `{{company}}`, `{{title}}`

### Enrollment

- `id`, `campaignId`, `leadId` (unique pair)
- `currentStep` (index into SequenceStep)
- `status`: `active` | `completed` | `unsubscribed` | `bounced` | `failed`
- `nextSendAt`
- `createdAt`, `updatedAt`

### SendLog

- `id`, `enrollmentId`, `stepId`
- `resendId` (nullable), `status`, `error` (nullable), `sentAt`

## Sequence send flow

1. Create campaign + ordered steps (subject/body + `delayDays`).
2. Enroll selected leads (skip leads already enrolled or without email).
3. On enroll: set `currentStep = 0`, `status = active`, `nextSendAt = now`.
4. Cron (every 1–5 minutes):
   - Authenticate with `CRON_SECRET`
   - Load due enrollments where campaign is `active`, enrollment is `active`, `nextSendAt <= now`
   - Process in small batches (20–50 per tick)
   - Render template merge fields → send via Resend
   - Write `SendLog`
   - On success: if more steps remain, increment `currentStep` and set `nextSendAt = now + next.delayDays`; else mark `completed`
   - On transient failure: one automatic retry on a later cron tick; if that fails, mark enrollment `failed`
   - On Resend hard-fail / bounce response: mark enrollment `bounced` or `failed` and stop
5. Pause campaign: cron skips enrollments for that campaign. Resume restores sending without resetting steps.

### Unsubscribe

Every email includes an unsubscribe link that marks the enrollment `unsubscribed` and stops further steps for that lead in that campaign. Resend bounce webhooks are optional nicety for v1; send API errors are enough to mark failures.

## Error handling

- Apollo/Resend API errors return clear messages in the UI
- Import summarizes: imported / updated / skipped (no email) / failed
- Cron endpoint rejects missing/invalid `CRON_SECRET`
- Send failures persist on `SendLog` and enrollment status for inspection on Campaign detail

## Out of scope (v1)

- Multi-user accounts / teams / RBAC
- Open/click analytics dashboards (optional Resend webhook basics only if trivial)
- SMS, LinkedIn, A/B testing
- Full CRM pipeline statuses beyond campaign enrollment states
- Fixed industry preset packs

## Success criteria

- Search Apollo with arbitrary industry/keyword filters and import selected people
- Persist leads and export CSV
- Create a multi-step campaign, enroll leads, and have cron send steps via Resend on schedule
- Pause/resume campaigns and honor unsubscribe
- App is usable by a single operator behind an app password

## Testing (v1)

- Unit: merge-field rendering, delay/`nextSendAt` calculation, dedupe logic
- Integration: Apollo health + mocked people search; Resend send mocked; cron batch advancement
- Manual: end-to-end import → enroll → forced cron tick → verify SendLog
