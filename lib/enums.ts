// Enum lists live here rather than in lib/data.ts so client components can
// import them without dragging the server Supabase client into the bundle.
// lib/data.ts re-exports these, so existing server-side imports keep working.

export const STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'not_started', label: 'Not started' },
  { key: 'requirement_gathering', label: 'Requirement gathering' },
  { key: 'account_setup', label: 'Account setup' },
  { key: 'onboarded', label: 'Onboarded' },
  { key: 'done', label: 'Done' }
];

export const BLOCKER_STATES = ['open', 'in_progress', 'blocked_on_client', 'blocked_on_eng', 'resolved'];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const DEVICE_STATUSES = ['not_started', 'in_progress', 'blocked', 'degraded', 'live'];
export const READINESS = ['unknown', 'not_ready', 'partial', 'ready'];
export const PHOTO_CATEGORIES = ['site', 'kiosk', 'device', 'network', 'signage', 'issue', 'document', 'other'];
/**
 * Activities. Meetings are one shape of these, not the other way round — the
 * table is still called `meetings` for history, but a data migration and a
 * weekly sync are the same record: dated, owned, at a property, with notes and
 * photos. Keep TALKING first, then DOING, so the dialog reads sensibly.
 */
export const MEETING_KINDS = [
  'kickoff', 'weekly', 'review', 'training', 'ad_hoc',
  'data_migration', 'setup', 'connectivity', 'site_visit', 'go_live'
];

/** Kinds where nobody "attends" and nothing is "held" — work, not a call. */
export const DOING_KINDS = new Set(['data_migration', 'setup', 'connectivity', 'site_visit']);

export const MEETING_STATES = ['scheduled', 'held', 'cancelled', 'no_show'];
export const RAMP_STATES = ['not_started', 'in_progress', 'done', 'skipped'];
