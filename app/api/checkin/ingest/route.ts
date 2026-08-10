// Check-in event ingest. The funnel schema has existed since the port with
// nothing writing to it; this is the writer, so the kiosk bridge has somewhere
// to send step events.
//
// Security posture, deliberately conservative:
//  - The check-in tables stay anon-READ-only. The publishable key is in the
//    browser bundle, so if anon could write here anyone could forge the funnel.
//    Writes go through the service role key, which is server-only.
//  - A shared bearer token is required on top of that.
//  - If either secret is missing the route reports itself disabled and writes
//    nothing. An ingest endpoint that silently accepts unauthenticated data is
//    worse than one that is off.

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  CHECKIN_INGEST_READY, CHECKIN_INGEST_TOKEN, SUPABASE_SERVICE_KEY, SUPABASE_URL
} from '@/lib/config';

export const dynamic = 'force-dynamic';

type StepRow = {
  property_id: string;
  step_key: string;
  day: string;
  entered_count?: number;
  completed_count?: number;
  failed_count?: number;
  abandoned_count?: number;
  p50_duration_ms?: number | null;
  p95_duration_ms?: number | null;
};

type FailureRow = {
  property_id: string;
  step_key: string;
  occurred_at: string;
  external_booking_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  raw?: unknown;
};

const isIso = (v: unknown) => typeof v === 'string' && !Number.isNaN(new Date(v).getTime());
const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Counts are non-negative integers. Anything else corrupts the funnel silently. */
const isCount = (v: unknown) => v === undefined || v === null || (Number.isInteger(v) && (v as number) >= 0);
const bad = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

/** Constant-time over the full string, and length-safe because it hashes first. */
function tokenMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // timingSafeEqual throws on length mismatch, so compare against self to
    // keep the work done roughly constant before returning.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** GET is a health probe, so the bridge can tell "not deployed" from "not configured". */
export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: CHECKIN_INGEST_READY,
    accepts: { steps: 'checkin_step_daily rows', failures: 'checkin_failures rows' }
  });
}

export async function POST(request: Request) {
  if (!CHECKIN_INGEST_READY) {
    return bad(
      'Check-in ingest is not configured. Set CHECKIN_INGEST_TOKEN and SUPABASE_SERVICE_ROLE_KEY.',
      503
    );
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  // The CHECKIN_INGEST_READY guard above is load-bearing: were it not first, an
  // empty configured token plus a bare "Bearer " header would compare equal and
  // authorise.
  if (!tokenMatches(token, CHECKIN_INGEST_TOKEN)) return bad('Unauthorised', 401);

  let body: { steps?: StepRow[]; failures?: FailureRow[] };
  try {
    body = await request.json();
  } catch {
    return bad('Body must be JSON');
  }

  const steps = Array.isArray(body?.steps) ? body.steps : [];
  const failures = Array.isArray(body?.failures) ? body.failures : [];
  if (!steps.length && !failures.length) return bad('Send at least one of steps[] or failures[]');
  if (steps.length > 1000 || failures.length > 1000) return bad('Send at most 1000 rows per call');

  for (const s of steps) {
    if (!UUID.test(String(s?.property_id))) return bad('Each step needs a UUID property_id');
    if (!s?.step_key) return bad('Each step needs a step_key');
    if (!isDay(s.day)) return bad('Step day must be YYYY-MM-DD');
    if (
      ![s.entered_count, s.completed_count, s.failed_count, s.abandoned_count,
        s.p50_duration_ms, s.p95_duration_ms].every(isCount)
    ) {
      return bad('Step counts and durations must be non-negative integers');
    }
  }
  for (const f of failures) {
    if (!UUID.test(String(f?.property_id))) return bad('Each failure needs a UUID property_id');
    if (!f?.step_key) return bad('Each failure needs a step_key');
    if (!isIso(f.occurred_at)) return bad('Failure occurred_at must be an ISO timestamp');
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Steps are a daily rollup keyed by (property, step, day), so re-sending a
  // day is an update rather than a duplicate — the bridge can safely retry.
  //
  // That holds ACROSS calls. Within one call it does not: two rows sharing the
  // conflict key make Postgres raise "ON CONFLICT DO UPDATE command cannot
  // affect row a second time". Collapse duplicates last-write-wins first.
  const dedupedSteps = Array.from(
    steps.reduce((m, s) => m.set(`${s.property_id}|${s.step_key}|${s.day}`, s), new Map<string, StepRow>()).values()
  );

  if (dedupedSteps.length) {
    const { error } = await db.from('checkin_step_daily').upsert(
      dedupedSteps.map((s) => ({
        property_id: s.property_id,
        step_key: s.step_key,
        day: s.day,
        entered_count: s.entered_count ?? 0,
        completed_count: s.completed_count ?? 0,
        failed_count: s.failed_count ?? 0,
        abandoned_count: s.abandoned_count ?? 0,
        p50_duration_ms: s.p50_duration_ms ?? null,
        p95_duration_ms: s.p95_duration_ms ?? null,
        synced_at: new Date().toISOString()
      })),
      { onConflict: 'property_id,step_key,day' }
    );
    // Log the driver detail server-side; do not put schema internals on the wire.
    if (error) {
      console.error('checkin ingest: steps write failed', error);
      return bad('Could not write steps', 502);
    }
  }

  if (failures.length) {
    const { error } = await db.from('checkin_failures').insert(
      failures.map((f) => ({
        property_id: f.property_id,
        step_key: f.step_key,
        occurred_at: f.occurred_at,
        external_booking_id: f.external_booking_id ?? null,
        error_code: f.error_code ?? null,
        error_message: f.error_message ?? null,
        raw: f.raw ?? null
      }))
    );
    if (error) {
      console.error('checkin ingest: failures write failed', error);
      return bad('Could not write failures', 502);
    }
  }

  return NextResponse.json({ ok: true, steps: dedupedSteps.length, failures: failures.length });
}
