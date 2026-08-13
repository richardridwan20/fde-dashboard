// Pure helpers used by BOTH server and client components.
//
// These must not live in components/ui.tsx. That module carries 'use client',
// which turns every one of its exports into a client reference — a server
// component that *calls* one gets "Attempted to call stateTone() from the
// server but stateTone is on the client" at request time. `next build` does not
// catch it, because every page here is force-dynamic and the call only happens
// on a real request.
//
// Rendering a client *component* from the server is fine. Calling a client
// *function* from the server is not. Keep plain functions here.

/**
 * "1 task" / "0 tasks" / "5 tasks". Every ad-hoc `n > 1 ? 's' : ''` in this app
 * got the zero case wrong ("0 photo") and every bare `${n} tasks` got the one
 * case wrong ("1 tasks"), so counts go through here.
 */
export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * State reads differently for work than for a call: a migration is "done", not
 * "held", and it cannot "no show". Labels only — the stored value is unchanged,
 * so nothing downstream has to know about this.
 */
export function activityState(kind: string, state: string) {
  const doing = ['data_migration', 'setup', 'connectivity', 'site_visit'].includes(kind);
  if (!doing) return state.replace(/_/g, ' ');
  return { scheduled: 'planned', held: 'done', cancelled: 'cancelled', no_show: 'did not happen' }[
    state
  ] || state.replace(/_/g, ' ');
}

/** 'blocked_on_client' → 'Blocked on client' */
export const humanise = (s: string) => {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const enumOptions = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: humanise(v) }));

export const severityTone = (s: string) =>
  s === 'critical' ? 'bad' : s === 'high' ? 'warn' : s === 'medium' ? 'info' : 'neutral';

export const stateTone = (s: string) =>
  s === 'resolved' || s === 'live' || s === 'ready' || s === 'done' || s === 'held'
    ? 'good'
    : s === 'blocked' || s === 'blocked_on_eng' || s === 'not_ready' || s === 'cancelled' || s === 'no_show'
      ? 'bad'
      : s === 'blocked_on_client' || s === 'degraded' || s === 'partial'
        ? 'warn'
        : s === 'in_progress' || s === 'scheduled'
          ? 'info'
          : 'neutral';
