// Go-live gate and stage-drift surfaces. Server-rendered — no 'use client'.
//
// The portfolio already showed "in 9d". A countdown is not a plan: it says
// when, never whether. These components answer "what must be true before that
// date, and which clause is currently false".

import Link from 'next/link';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Card, CardHeader, Empty, Pill } from '@/components/ui';
import { plural } from '@/lib/ui-helpers';
import { cn } from '@/lib/utils';

/** A property is "watched" once it has a date near enough to act on. */
export const isWatched = (g: any) =>
  g.days_to_go_live !== null && g.days_to_go_live <= 30 && !g.went_live_at;

export function GateTone({ gate }: { gate: any }) {
  if (!gate || gate.days_to_go_live === null) return <span className="text-faint">—</span>;
  const d = gate.days_to_go_live;
  const late = d < 0;
  return (
    <Pill tone={gate.is_ready ? 'good' : late ? 'bad' : d <= 14 ? 'warn' : 'info'}>
      {gate.is_ready ? 'ready' : late ? `${Math.abs(d)}d over, not ready` : `not ready · ${d}d`}
    </Pill>
  );
}

function Clause({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 px-4 py-2">
      {ok ? (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
      )}
      <div className="min-w-0">
        <div className={cn('text-[13px]', !ok && 'font-medium')}>{label}</div>
        <div className="text-[11px] text-faint">{detail}</div>
      </div>
      <span className="sr-only">{ok ? 'passing' : 'failing'}</span>
    </div>
  );
}

/** Full gate breakdown, for the property page. */
export function GatePanel({ gate }: { gate: any }) {
  if (!gate) return null;
  if (gate.days_to_go_live === null) {
    return (
      <Card>
        <CardHeader title="Go-live gate" />
        <Empty>No onboarding date set, so there is nothing to count down to.</Empty>
      </Card>
    );
  }

  const d = gate.days_to_go_live;
  const when = gate.went_live_at
    ? 'live'
    : d < 0
      ? `${Math.abs(d)} ${d === -1 ? 'day' : 'days'} past the onboarding date`
      : d === 0
        ? 'today'
        : `${plural(d, 'day')} to go`;

  return (
    <Card>
      <CardHeader
        title="Go-live gate"
        sub={when}
        right={<GateTone gate={gate} />}
      />
      <div className="divide-y divide-line">
        <Clause
          ok={gate.checklist_ok}
          label="Required checklist items ticked"
          detail={
            gate.checklist_total === 0
              ? 'No gating items configured for this property'
              : `${gate.checklist_done} of ${gate.checklist_total} done`
          }
        />
        <Clause
          ok={gate.integrations_ok}
          label="Installed devices are live"
          detail={
            gate.integrations_total === 0
              ? 'No devices recorded'
              : `${gate.integrations_live} of ${gate.integrations_total} live` +
                (gate.integrations_stuck > 0
                  ? ` · ${gate.integrations_stuck} blocked or degraded`
                  : '')
          }
        />
        <Clause
          ok={gate.blockers_ok}
          label="No open critical or high blockers"
          detail={
            gate.serious_blockers === 0
              ? `${plural(gate.open_blockers, 'blocker')} open, none serious`
              : `${plural(gate.serious_blockers, 'critical or high blocker')} still open`
          }
        />
      </div>
    </Card>
  );
}

/** Portfolio banner: only the properties close enough to a date to matter. */
export function GoLiveWatch({ gates }: { gates: any[] }) {
  const watched = gates.filter(isWatched).filter((g) => !g.is_ready);
  if (!watched.length) return null;

  return (
    <Card>
      <CardHeader
        title="Go-live watch"
        sub="Dated within 30 days and not yet clearing the gate"
        right={<span className="text-[11px] text-faint">{plural(watched.length, 'property', 'properties')}</span>}
      />
      <div className="divide-y divide-line">
        {watched.map((g: any) => {
          const failing = [
            !g.checklist_ok &&
              `checklist ${g.checklist_done}/${g.checklist_total}`,
            !g.integrations_ok &&
              `devices ${g.integrations_live}/${g.integrations_total} live`,
            !g.blockers_ok && plural(g.serious_blockers, 'serious blocker')
          ].filter(Boolean);
          return (
            <div key={g.property_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <Link href={`/property/${g.slug}`} className="text-[13px] font-medium hover:underline">
                  {g.name}
                </Link>
                <div className="text-[11px] text-faint">{failing.join(' · ')}</div>
              </div>
              <GateTone gate={g} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Stage drift. Only ever nags upward — see the v_stage_check comment. Shown as
 * a prompt rather than applied automatically, because a wrong auto-correction
 * is harder to notice than a stale value.
 */
export function StageDriftBanner({ stale }: { stale: any[] }) {
  if (!stale?.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-amber-900">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {plural(stale.length, 'property', 'properties')} recorded behind the evidence
      </div>
      <p className="mt-1 text-[12px] text-amber-800">
        Stage is set by hand, and “In flight” on this page counts it. These look further along
        than they say they are.
      </p>
      <ul className="mt-1.5 space-y-1 text-[12px] text-amber-800">
        {stale.slice(0, 6).map((s: any) => (
          <li key={s.property_id}>
            <Link href={`/property/${s.slug}`} className="underline">
              {s.name}
            </Link>{' '}
            — says <span className="font-medium">{String(s.stage).replace(/_/g, ' ')}</span>, but has{' '}
            {[
              s.checklist_done > 0 && `${plural(s.checklist_done, 'checklist item')} ticked`,
              s.integrations_started > 0 && `${plural(s.integrations_started, 'device')} underway`,
              s.meetings_held > 0 && `${plural(s.meetings_held, 'meeting')} held`
            ]
              .filter(Boolean)
              .join(', ')}{' '}
            → looks like{' '}
            <span className="font-medium">{String(s.evidence_stage).replace(/_/g, ' ')}</span>
          </li>
        ))}
        {stale.length > 6 && <li>and {stale.length - 6} more</li>}
      </ul>
    </div>
  );
}
