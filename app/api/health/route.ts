// Config health. Booleans only — never a key, never a prefix, never a length.
//
// Exists because "is the env var actually reaching the build?" was otherwise a
// guessing game: Vercel injects variables at deploy time, so a var added after
// a build is invisible until the next one, and nothing in the UI tells you
// which deployment saw what. This turns that into a URL.

import { NextResponse } from 'next/server';
import { CHECKIN_INGEST_READY, NARRATIVE_READY, NARRATIVE_MODEL, AUTH_ENABLED } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    region: process.env.VERCEL_REGION || 'local',
    builtAt: process.env.VERCEL_DEPLOYMENT_ID ? undefined : 'local',
    config: {
      // true means the variable is present and non-empty in THIS deployment.
      narrativeDrafting: NARRATIVE_READY,
      narrativeModel: NARRATIVE_MODEL,
      checkinIngest: CHECKIN_INGEST_READY,
      authGate: AUTH_ENABLED
    }
  });
}
