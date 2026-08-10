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
