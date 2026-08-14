export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pmmyqxdmjyxzsknvfpbr.supabase.co';
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_qUiVleGmbSe-RIyDPtsF6Q_E2cK2veB';

export const ALLOWED_DOMAIN = 'wasimil.com';

/**
 * Check-in ingest. Both must be set for POST /api/checkin/ingest to accept
 * anything; absent, the route reports itself disabled rather than silently
 * accepting writes. The service key is deliberately NOT prefixed NEXT_PUBLIC —
 * it must never reach the browser, and the check-in tables stay anon-read-only
 * so the publishable key cannot be used to forge funnel data.
 */
/**
 * Narrative drafting. Server-only — no NEXT_PUBLIC_ prefix, or the key ships in
 * the browser bundle. Absent, the Draft button reports itself unconfigured
 * rather than failing at click time.
 */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const NARRATIVE_MODEL = process.env.NARRATIVE_MODEL || 'claude-sonnet-5';
export const NARRATIVE_READY = Boolean(ANTHROPIC_API_KEY);

export const CHECKIN_INGEST_TOKEN = process.env.CHECKIN_INGEST_TOKEN || '';
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const CHECKIN_INGEST_READY = Boolean(CHECKIN_INGEST_TOKEN && SUPABASE_SERVICE_KEY);

/** Auth gate. Off unless explicitly enabled, so the URL is public by default. */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';

export const PHOTO_BUCKET = 'property-photos';

/** Vercel rejects function request bodies above ~4.5 MB before app code runs. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const IMG_MAX_DIM = 1920;
export const IMG_QUALITY = 0.82;
