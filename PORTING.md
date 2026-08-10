# Port status — complete

The whole app now lives in this repo. Nothing is left in the paste deployment that is not here, and
several things here are ahead of what is deployed.

Verified with a real production build:

```
npm install
npx next build     # ✓ compiled, types valid, 15 routes
```

## What was written in this pass

| Area | Files |
|---|---|
| Primitives | `components/ui.tsx` — button, input, textarea, field, select, checkbox, dialog, card, pill, toaster |
| Display | `components/shared.tsx`, `components/clickup.tsx`, `components/property-blockers.tsx` |
| Inline edits | `components/quick-edit.tsx` — select, text, date, tick, two-tap confirm, action button |
| Forms | `components/forms/*` — blocker, client details, device, meeting, new client, photo upload |
| New surfaces | `app/meetings`, `app/reports`, `components/markdown-editor.tsx`, `components/report-panel.tsx` |
| Rebuilt on shadcn | `components/checklist.tsx`, `components/photo-grid.tsx`, `components/readiness-panel.tsx` |
| Pages | overview, property, blockers, devices, photos, clickup, changes, team, clients/new, login, 404 |
| Shell | `middleware.ts`, `app/layout.tsx` |

## Deploy A — done

- `/meetings` — upcoming and past lists, schedule dialog with a pasted Meet link, state changes,
  markdown notes editor with live preview, photos attached to a meeting and clickable to embed
- `/reports` — the FDE hub format from `lib/report.ts`, per property, week navigation, four editable
  narrative sections saved to `weekly_reports`, copy-as-markdown

## Deploy B — done

- Onboarding checklist rebuilt on the shadcn controls
- Photo caption editing inline
- Bulk photo delete with storage cleanup
- Readiness panel for PMS / channel manager / payment gateway

## Database changes made in this pass

- `public.ramp_tasks` (writable) and `public.v_ramp_tasks` — first-week homework was in `fde` but
  never exposed, so PostgREST could not read it
- `public.v_checkin_funnel`, `public.v_checkin_failures`, `public.v_checkin_steps` — exposed for the
  day something feeds them; all three are empty today
- Seeded Reza Winu Ulfani (integrations) and Rido Ramadano Rachman (onboarding) as team members, and
  generated Reza's seven week-one tasks from the existing `Integrations specialist — week 1` template

## Still open

- Hasura connector — the only remaining source. It should overwrite `readiness_*` (the
  `readiness_source` column already distinguishes manual from synced) and fill `bridge_reports`.
- Onboarding Agent App — still the least-defined dependency. Nothing has been assumed about its
  shape.
- Check-in funnel data. See README.
- Slack/Teams channel ingestion.
