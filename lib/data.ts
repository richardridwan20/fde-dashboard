import { getSupabase } from '@/lib/supabase/server';

// Enums moved to lib/enums.ts so client components can import them safely.
export * from '@/lib/enums';

/**
 * Every read goes through a view in `public`. Base tables live in `fde`, which
 * PostgREST does not serve — addressing them from the client fails silently.
 */
async function q(view: string, build: (b: any) => any) {
  const supabase = await getSupabase();
  const { data, error } = await build(supabase.from(view).select('*'));
  if (error) throw new Error(`${view}: ${error.message}`);
  return data || [];
}

// Portfolio
export const getOverview = () =>
  q('v_property_overview', (b) =>
    b.order('group_order').order('stage_rank', { ascending: false }).order('name')
  );
export const getGroups = () => q('v_property_groups', (b) => b.order('display_order'));
export const getReadiness = () => q('v_readiness', (b) => b.order('name'));

// Blockers
export const getAllBlockers = () => q('v_blockers', (b) => b.neq('state', 'resolved').order('eta'));
export const getResolvedBlockers = () =>
  q('v_blockers', (b) => b.eq('state', 'resolved').order('opened_at', { ascending: false }).limit(20));
export const getPropertyBlockers = (id: string) =>
  q('v_blockers', (b) => b.eq('property_id', id).order('state').order('eta'));
/** Every blocker for a property, resolved included — the weekly report needs both. */
export const getBlockersForReport = (id: string) => q('v_blockers', (b) => b.eq('property_id', id));

// Devices
export const getAllIntegrations = () => q('v_property_integrations', (b) => b.order('display_order'));
export const getIntegrationTypes = () => q('v_integration_types', (b) => b.order('display_order'));
export const getPropertyIntegrations = (id: string) =>
  q('v_property_integrations', (b) => b.eq('property_id', id).order('display_order'));

// Checklist, photos, activity
export const getPropertyChecklist = (id: string) =>
  q('v_checklist', (b) => b.eq('property_id', id).order('display_order'));
export const getAllPhotos = () => q('v_photos', (b) => b.order('created_at', { ascending: false }));
export const getPropertyPhotos = (id: string) =>
  q('v_photos', (b) => b.eq('property_id', id).order('created_at', { ascending: false }));
export const getMeetingPhotos = (meetingId: string) =>
  q('v_photos', (b) => b.eq('meeting_id', meetingId).order('created_at'));
export const getPropertyActivity = (id: string) =>
  q('v_activity', (b) => b.eq('property_id', id).order('occurred_at', { ascending: false }).limit(100));
// Both feeds fetch one row past the cap so the page can tell "this is all of
// it" from "this is the first 60 of an unknown number" and label itself
// honestly. Callers should slice back to the LIMIT before rendering.
export const CHANGES_LIMIT = 60;
export const AUDIT_LIMIT = 50;

export const getRecentChanges = () =>
  q('v_recent_changes', (b) => b.order('occurred_at', { ascending: false }).limit(CHANGES_LIMIT + 1));

// Meetings
export const getAllMeetings = () => q('v_meetings', (b) => b.order('starts_at', { ascending: false }));
export const getPropertyMeetings = (id: string) =>
  q('v_meetings', (b) => b.eq('property_id', id).order('starts_at', { ascending: false }));

// ClickUp
export const getClickupTasks = () =>
  q('v_clickup_tasks', (b) => b.order('updated_at_source', { ascending: false }));
export const getPropertyTasks = (id: string) =>
  q('v_clickup_tasks', (b) => b.eq('property_id', id).order('updated_at_source', { ascending: false }));
export const getDrift = () => q('v_blocker_task_drift', (b) => b.order('property_name'));
export const getPropertyDrift = (slug: string) =>
  q('v_blocker_task_drift', (b) => b.eq('property_slug', slug));

// Team ramp-up ("first week homework")
export const getRampTasks = () =>
  q('v_ramp_tasks', (b) => b.order('member_name').order('display_order'));
export const getMemberRampTasks = (memberId: string) =>
  q('v_ramp_tasks', (b) => b.eq('member_id', memberId).order('display_order'));

// Check-in funnel. Nothing writes to these yet — see README.
export const getCheckinSteps = () => q('v_checkin_steps', (b) => b.order('step_order'));
export const getCheckinFunnel = (sinceIso: string) =>
  q('v_checkin_funnel', (b) => b.gte('day', sinceIso).order('day', { ascending: false }));
export const getCheckinFailures = () =>
  q('v_checkin_failures', (b) => b.order('occurred_at', { ascending: false }).limit(50));

// Go-live gate, stage drift, waiting-on-client
export const getGoLiveGate = () => q('v_go_live_gate', (b) => b.order('days_to_go_live'));
export const getPropertyGate = (id: string) =>
  q('v_go_live_gate', (b) => b.eq('property_id', id)).then((r: any[]) => r[0] || null);
/** Only properties whose evidence outranks their recorded stage. */
export const getStaleStages = () => q('v_stage_check', (b) => b.eq('is_stale', true).order('name'));
/** Longest wait first — the whole point is spotting what has gone quiet. */
export const getWaitingOnClient = () =>
  q('v_blockers', (b) =>
    b.eq('state', 'blocked_on_client').order('waiting_days', { ascending: false })
  );

// Minutes generation
export const getSlackPeople = () => q('v_slack_people', (b) => b.order('display_name'));
export const getMomCc = (propertyId: string) =>
  q('v_mom_cc', (b) => b.eq('property_id', propertyId)).then(
    (r: any[]) => (r[0]?.cc_keys as string[]) || []
  );

// Reference and housekeeping
export const getWorkstreams = () => q('v_workstreams', (b) => b.order('display_order'));
export const getTeam = () => q('v_team', (b) => b.order('role'));
export const getSyncExceptions = () => q('v_sync_exceptions', (b) => b.order('seen_at', { ascending: false }));
export const getAudit = () =>
  q('v_audit', (b) => b.order('changed_at', { ascending: false }).limit(AUDIT_LIMIT + 1));

export async function getProperty(slug: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('v_property_overview')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getWeeklyNarrative(propertyId: string, weekStart: string) {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('property_id', propertyId)
    .eq('week_start', weekStart)
    .maybeSingle();
  return data;
}

/** A client is "in flight" when it is neither an untouched lead nor finished. */
export const isActive = (r: any) => r.stage !== 'lead' && r.stage !== 'done';
export const isPastDue = (r: any) =>
  r.days_to_onboarding !== null && r.days_to_onboarding < 0 && isActive(r);
