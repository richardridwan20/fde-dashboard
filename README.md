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

## Latency and loading

Functions are pinned to `sin1` in `vercel.json`. The Vercel default is `iad1`
(Washington), while the Supabase project is `ap-southeast-1` (Singapore) — so every
query crossed the Pacific twice, on top of the user-to-function hop from Japan. Keep the
function region next to the database; if the Supabase project ever moves, move this too.

Every route has a `loading.tsx`. Two reasons, and the second is the less obvious one:

1. App Router navigation blocks by default. Without a boundary, a nav click renders
   nothing until the full RSC payload lands, and since it is a client-side transition the
   browser shows no spinner either — it reads as lag.
2. For a `force-dynamic` route Next prefetches only as far as the first loading boundary.
   With no boundary there is nothing to prefetch, so hovering a link did no useful work.

Skeletons live in `components/skeleton.tsx` and mirror each page's real shape (metric
count, column count) so nothing jumps on arrival. Routes whose heading is data-driven —
`/property/[slug]` — omit the title so it does not flash the wrong text.

## Known gaps

- ClickUp is a one-off load, not a live sync. Statuses are frozen at the last pull.
- Bridge health (`bridge_reports`) is empty; waiting on the Hasura connector.
- Readiness (PMS, channel manager, payment gateway) is manual until that lands.
- Meetings hold a pasted Meet URL. Real calendar events need Google Calendar API access.
- Every edit records `changed_by: anon` while the auth gate is off.
- **The check-in funnel has no data yet.** `/checkin` exists and `POST /api/checkin/ingest` is the
  writer, but `fde.checkin_step_daily` and `fde.checkin_failures` are still empty until the kiosk
  bridge starts sending. The page renders an explicit "no events" state listing the five defined
  steps rather than a zeroed funnel, because an empty funnel reads as a healthy one.
- Reza's and Rido's start dates are guesses (2026-08-10). Correct them in `fde.team_members`.

## Check-in ingest

`/checkin` is only as good as what feeds it. The endpoint is off until both env vars are set in
Vercel, and reports itself off rather than accepting unauthenticated writes:

| Variable | Purpose |
|---|---|
| `CHECKIN_INGEST_TOKEN` | Shared secret. The bridge sends `Authorization: Bearer <token>`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only write key. Never prefix this `NEXT_PUBLIC_`. |

The check-in tables stay **anon-read-only** on purpose. The publishable key ships in the browser
bundle, so if `anon` could write here anyone could forge the funnel — which is worse than having
no funnel, because it would look authoritative.

`GET /api/checkin/ingest` is a health probe returning `{ configured: true|false }`, so the bridge
can tell "not deployed" from "not configured".

```bash
curl -X POST https://wasimil-fde-dashboard.vercel.app/api/checkin/ingest \
  -H "Authorization: Bearer $CHECKIN_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [{ "property_id": "<uuid>", "step_key": "id_scan", "day": "2026-08-10",
                "entered_count": 40, "completed_count": 31, "failed_count": 9 }],
    "failures": [{ "property_id": "<uuid>", "step_key": "id_scan",
                   "occurred_at": "2026-08-10T09:12:00Z", "error_code": "OCR_TIMEOUT" }]
  }'
```

Steps are a daily rollup keyed by `(property_id, step_key, day)` and upserted, so resending a day
corrects it rather than double-counting — the bridge can retry safely. Failures are append-only.

## Go-live gate

`v_go_live_gate` turns the onboarding date from a countdown into a pass/fail. Three clauses, all
of which must hold:

1. every checklist item flagged `checklist_items.is_go_live_gate` is ticked;
2. every device recorded against the property is `live`;
3. no open `critical` or `high` blockers.

Clause 2 counts **installed** devices, not `integration_types.is_required` — every type currently
has `is_required = false`, which made that clause vacuously true for all 33 properties. A Glory
cash machine on site and not working blocks go-live whether or not the type is universally
required. Retune which checklist items gate by flipping `is_go_live_gate`; no deploy needed.

`v_stage_check` flags properties whose evidence (checklist progress, devices underway, meetings
held) outranks their recorded stage. It only ever nags **upward** — parking something at a later
stage deliberately is legitimate and should not be second-guessed — and it prompts rather than
auto-corrects, because a wrong automatic correction is harder to spot than a stale value.

## Weekly report — how it actually behaves

`lib/report.ts` derives SHIPPED THIS WEEK from blockers resolved since Monday plus ClickUp tasks
moved to done since Monday. Both are timestamp-driven, so a bulk backfill lands everything in the
week the backfill ran, not the week the work happened. The current Piece Hostel data was resolved
in one pass on 9 August, which is why "week of 10th August" shows nothing shipped and "week of
03rd August" shows all five. That is the data, not the generator.
