# Wasimil FDE Dashboard

Command centre for Forward Deployed Engineering: client onboarding, blockers, kiosk device health,
site photos, meetings and the weekly status report.

- **Live:** https://wasimil-fde-dashboard.vercel.app
- **Database:** Supabase project `pmmyqxdmjyxzsknvfpbr` (ap-southeast-1)
- **Stack:** Next.js 15 App Router, React 19, Tailwind, shadcn/ui primitives, react-hook-form + zod, Supabase

## Why this repo exists

The app was originally deployed by pasting the whole file tree into Vercel on every change. It
outgrew that — the tree is ~30 files and a single payload stopped fitting. Connect this repo to
Vercel and every change becomes a normal commit with real diffs and rollback.

## First run

```bash
cd fde-dashboard
npm install
npm run dev
```

Everything falls back to working defaults in `lib/config.ts`, so it runs with no `.env` at all.

## Connecting to Vercel

The Vercel project `wasimil-fde-dashboard` already exists and owns the production domain.

```bash
git init && git add -A && git commit -m "Import FDE dashboard"
git remote add origin <your-repo-url>
git push -u origin main
```

Then **Vercel → Project → Settings → Git → Connect Git Repository**. Pushes to `main` go to
production; every branch gets a preview URL.

## Environment

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_AUTH_ENABLED` | `true` turns the Google SSO gate back on. Currently off, so the URL is public. |
| `NEXT_PUBLIC_SUPABASE_URL` | Override the Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key. Safe to expose; RLS enforces access. |

## Re-enabling auth

1. Google Cloud Console → Credentials → OAuth client ID (Web). Redirect URI:
   `https://pmmyqxdmjyxzsknvfpbr.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Providers → Google → paste client ID and secret.
3. Supabase → Authentication → URL Configuration → add
   `https://wasimil-fde-dashboard.vercel.app/auth/callback`.
4. Set `NEXT_PUBLIC_AUTH_ENABLED=true` in Vercel.
5. In Supabase, drop the `anon_read` / `anon_write` policies in the `fde` schema — they exist only
   because the gate is off. Until you do, the database is readable without a login.

## Layout

```
app/              routes; every page is `dynamic = 'force-dynamic'`
components/ui.tsx shadcn primitives (button, input, select, dialog, field, checkbox, toaster)
components/       shared display, inline quick-edit controls, form dialogs, markdown editor
lib/data.ts       every read, one function per view
lib/actions.ts    every write, all returning { ok, message } for toasts
lib/report.ts     generates the weekly status in the FDE hub format
```

## Conventions worth keeping

- **Reads go through views**, never base tables. Views live in `public`, tables in `fde`.
- **Writes go through `public` pass-through views** (`blockers`, `properties`, `meetings`, …)
  because PostgREST only serves the `public` schema. Addressing `fde.*` from the client silently
  fails — this cost a day once.
- **Actions never throw to the UI.** They return `{ ok, message }` and the caller raises a toast.
- **Nothing is invented.** If a value did not come from a source, the UI says so rather than filling
  the gap. Rows that could not be imported are recorded in `sync_exceptions`.
- **Never export a plain function from a `'use client'` module.** Its exports become client
  references; a server component that *calls* one throws at request time
  ("Attempted to call stateTone() from the server"). `next build` cannot catch this because every
  page is force-dynamic and nothing renders during the build. Shared helpers live in
  `lib/ui-helpers.ts`. `npm run check` enforces it and runs automatically before `npm run build`.

## Known gaps

- ClickUp is a one-off load, not a live sync. Statuses are frozen at the last pull.
- Bridge health (`bridge_reports`) is empty; waiting on the Hasura connector.
- Readiness (PMS, channel manager, payment gateway) is manual until that lands.
- Meetings hold a pasted Meet URL. Real calendar events need Google Calendar API access.
- Every edit records `changed_by: anon` while the auth gate is off.
- **The check-in funnel has no data.** `fde.checkin_step_daily` and `fde.checkin_failures` are
  empty — the five steps (`booking_matched → guest_details → id_scan → payment_auth →
  room_assigned`) are defined but nothing writes to them. Views `v_checkin_funnel`,
  `v_checkin_failures` and `v_checkin_steps` exist and readers are wired in `lib/data.ts`, so the
  UI can be built the day a source appears. Until then there is no check-in page, because an empty
  one would imply the flow is healthy.
- Reza's and Rido's start dates are guesses (2026-08-10). Correct them in `fde.team_members`.

## Weekly report — how it actually behaves

`lib/report.ts` derives SHIPPED THIS WEEK from blockers resolved since Monday plus ClickUp tasks
moved to done since Monday. Both are timestamp-driven, so a bulk backfill lands everything in the
week the backfill ran, not the week the work happened. The current Piece Hostel data was resolved
in one pass on 9 August, which is why "week of 10th August" shows nothing shipped and "week of
03rd August" shows all five. That is the data, not the generator.
