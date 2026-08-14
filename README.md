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

`middleware.ts` short-circuits while `AUTH_ENABLED` is false. It runs at the edge in the
user's own region, so the `sin1` pin does **not** move it — and its `getUser()` call was a
cross-region round trip on nearly every request, refreshing a session that cannot exist
while the gate is off.

The portfolio lives in the `app/(portfolio)/` route group rather than at `app/`. A
`loading.tsx` sitting next to `app/layout.tsx` wraps **every** nested segment, so `/devices`
was served a "Portfolio" heading and a 6-metric skeleton before swapping to its own. The
route group scopes that boundary to `/`.

Every route has a `loading.tsx`. Two reasons, and the second is the less obvious one:

1. App Router navigation blocks by default. Without a boundary, a nav click renders
   nothing until the full RSC payload lands, and since it is a client-side transition the
   browser shows no spinner either — it reads as lag.
2. For a `force-dynamic` route Next prefetches only as far as the first loading boundary.
   With no boundary there is nothing to prefetch, so hovering a link did no useful work.

Skeletons live in `components/skeleton.tsx` and mirror each page's real shape (metric
count, column count) so little jumps on arrival. Routes whose heading is data-driven —
`/property/[slug]` — omit the title so it does not flash the wrong text.

One accepted cost: `/property/<unknown-slug>` now returns **200** rather than 404. The
Suspense shell flushes before `notFound()` throws, so the status is already committed;
the not-found UI still renders via the streamed swap. Inherent to streaming, not worth
losing the skeleton on the slowest page in the app. `/nonsense` still 404s properly,
because the router resolves that one before any render.

`/login` deliberately has **no** `loading.tsx` — it does no async work, so a boundary buys
nothing and only risks flashing a heading that contradicts the page.

Two rules when adding one. Never promise a row the page might not render: `/checkin` and
`/photos` originally drew a 4-card metric row that does not exist, and a skeleton that
shrinks reads as content being taken away. And where an exact count is not knowable —
`/changes` day groups, `/` group tables — **under**-shoot, because growing downward reads
as arrival while shrinking reads as loss.

## Writable views drift from their base tables

`public.meetings`, `public.blockers`, `public.properties` and friends are **views** over
`fde.*`, and they are what PostgREST writes through. A view's column list is frozen when
it is created, so `alter table fde.x add column y` does **not** appear in `public.x`.

PostgREST reports the gap as *"Could not find the 'workstream' column of 'meetings' in
the schema cache"*, which reads like a stale cache and is not one — the column genuinely
is not in the view, and `notify pgrst, 'reload schema'` will not help. Saving a meeting
failed outright for this reason; `properties` had drifted by fourteen columns.

**Whenever you add a column to an `fde.*` table that the app writes to, recreate the
matching `public.*` view in the same migration.** Append new columns at the end so
`create or replace` stays legal, and keep `with (security_invoker = true)` or RLS stops
applying to the caller. This query lists any drift:

```sql
select w.table_name,
       (select string_agg(c.column_name, ', ')
          from information_schema.columns c
         where c.table_schema = 'fde' and c.table_name = w.table_name
           and c.column_name not in (select column_name from information_schema.columns
                                      where table_schema = 'public' and table_name = w.table_name)) as missing
from (select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'VIEW' and table_name not like 'v\_%') w;
```

## Activities (the `meetings` table)

`fde.meetings` holds **activities**, not just meetings. A weekly sync and a data migration
are the same record here: dated, owned, at a property, with attendees, markdown notes and
photos. `training` and `go_live` were already activities rather than meetings, so the table
had been drifting that way since it was created.

Kinds: `kickoff`, `weekly`, `review`, `training`, `ad_hoc`, then `data_migration`, `setup`,
`connectivity`, `site_visit`, `go_live`. The last four are "doing" kinds (`DOING_KINDS` in
`lib/enums.ts`), which only changes wording:

- state reads `planned / done` rather than `scheduled / held` (`activityState()` — labels
  only, the stored value is unchanged). Applied to the pills **and** the two state
  dropdowns via `activityStateOptions()`; a pill reading "done" beside a dropdown reading
  "Held" is worse than not relabelling at all.
- the audit trigger `fde.meeting_activity()` writes "Activity scheduled: …" and "… marked
  done". That summary is **stored** text, so unlike the pills it cannot be relabelled at
  render time — it has to be right when written.
- the minutes draft opens "Sharing here the summary of …" rather than "the minutes of
  meeting for …", and its first section is `Summary:` rather than `MoM:`

The table was **not** renamed. Doing so would churn every view, the wrapper view, the photo
FK, `lib/data.ts`, the report generator and the route — for a label. If it ever is renamed,
`activity_events` is taken: that is the audit feed.

### Group-level activities

An activity targets **exactly one** of a property or a group, enforced by
`meetings_target_ck` (`num_nonnulls(property_id, group_id) = 1`) so that "both" and
"neither" are unrepresentable. `property_photos` carries the same XOR — a group session's
photos are slides and screenshots, not photos *of* a property, so forcing one would be a
lie.

Group activities are **inherited, not copied**. One row is seen from all 29 COSMOS
properties, so editing the notes once updates what every one of them shows; copying would
have left you 29 sets of notes to keep in sync.

The OR lives in **`v_property_meetings`**, not in the caller. It started as a
`getPropertyMeetings(id, groupId)` parameter and two of the four consumers immediately
forgot to pass it — the weekly report and `/team`. A view makes forgetting impossible.
Anything that needs a property's activities should read `v_property_meetings` filtered on
`for_property_id`, never `v_meetings` filtered on `property_id`.

`v_stage_check` counts a held group activity as evidence for every member property, on the
same basis.

The audit trigger writes a group activity as a **portfolio-level** event
(`activity_events.property_id` is nullable) rather than fanning out 29 duplicate lines.
Per-property visibility comes from the inheritance above, not from the audit feed.

The cc line for a group activity resolves through `v_group_cc` — there is no property to
go via.

Photos attach to an activity through `property_photos.meeting_id`, which is why a migration
or an install can carry its evidence. They can also attach to a device
(`integration_key`) or a blocker (`blocker_id`). A photo belongs to a property **or** a
group, never both — `/photos` buckets group photos into their own card rather than
dropping them out of the property buckets while still counting them in the header.

## Minutes generator

`lib/mom.ts` turns meeting notes into the Slack minutes post. No model involved, and
deliberately so — the bullets are already your sentences, so this is templating rather
than summarisation, and a paraphrase in a message going to a client is a liability.

The notes headings are the contract:

| Heading | Becomes |
|---|---|
| `## Topics (@Name)` | a MoM bullet "@Name shares topic for {meeting title}" with the topics nested under it. The presenter is optional; without it the lead reads "Topics covered in …". |
| `## Feedbacks` | "Feedbacks from my notes:" and the bullets **verbatim** inside a fence, so `**bold**` and arrows survive unconverted |
| `## Action Items` | the Action Items list. A leading name — `@Nursandy`, `Nursandy`, or `Ikegami-san` — resolves to a mention; anything unrecognised is left alone rather than guessed at |
| `## Photos` | dropped — images cannot survive a clipboard paste |
| anything else | carried through as its own bullet group, because silently losing a section you wrote is worse than having to delete one |

Attendees produce the thank-you line; the cc line comes from `v_mom_cc` (property `mom_cc`,
falling back to its group's). People and their Slack IDs live in `fde.slack_people` —
`honorific` is per-person, not a rule: Ikegami-san takes one, Tom does not.

**What it will not do:** invent attribution the notes do not contain, decide an action item
was already handled and drop it, or sharpen wording. Those are judgement, and a model given
the same notes would not know them either — it would guess. Measured against a real post,
the generator produces roughly the right draft and the editing left over is the MoM
attribution and trimming the action items.

`&`, `<` and `>` are deliberately **not** escaped in the plain flavour. Slack only parses
`<…>` as link syntax for messages sent through the API; text pasted into the composer is
literal and Slack escapes it on send, so escaping here would make `a < b` paste as
`a &lt; b`. **If minutes ever get posted through the API rather than the clipboard, escape
at that send boundary — not in `toMrkdwn`, or paste breaks.**

Two clipboard flavours, because Slack does **not** convert a pasted `<@U123>` into a mention
— that only happens for messages sent through the API. "Copy for Slack" writes `text/html`
with real anchors to `/team/<id>`, which Slack keeps on paste; "Copy raw" is the plain
fallback.

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
