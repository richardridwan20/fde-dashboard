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
export const MEETING_KINDS = ['kickoff', 'weekly', 'training', 'go_live', 'review', 'ad_hoc'];
export const MEETING_STATES = ['scheduled', 'held', 'cancelled', 'no_show'];
export const RAMP_STATES = ['not_started', 'in_progress', 'done', 'skipped'];
