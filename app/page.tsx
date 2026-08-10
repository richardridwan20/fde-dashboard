import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  getOverview, getGroups, getAllBlockers, getDrift, getReadiness,
  getGoLiveGate, getStaleStages, isActive, isPastDue
} from '@/lib/data';
import { Button, Card, CardHeader, Empty, Pill, TableWrap } from '@/components/ui';
import { plural } from '@/lib/ui-helpers';
import { DriftBanner } from '@/components/clickup';
import { LeadFold } from '@/components/lead-fold';
import { GoLiveWatch, StageDriftBanner, atRiskGates } from '@/components/go-live';
import { Metric, Progress, StagePill, StatePill, ago, fmtDate } from '@/components/shared';

export const dynamic = 'force-dynamic';

export default async function Overview() {
  const [rows, groups, blockers, drift, readiness, gates, stale] = await Promise.all([
    getOverview(), getGroups(), getAllBlockers(), getDrift(), getReadiness(),
    getGoLiveGate(), getStaleStages()
  ]);

  const ready = new Map(readiness.map((r: any) => [r.property_id, r]));
  // Same predicate the watch card uses, so the count and the list cannot drift.
  const atRisk = atRiskGates(gates);
  const inFlight = rows.filter(isActive);
  const overdue = rows.filter(isPastDue);
  const live = rows.filter((r: any) => r.stage === 'done' || r.stage === 'onboarded');
  const blockedDevices = rows.reduce((n: number, r: any) => n + (r.integration_blocked || 0), 0);

  // Ungrouped properties get their own bucket at the end rather than vanishing.
  const bucketed = groups
    .map((g: any) => ({ group: g, items: rows.filter((r: any) => r.group_id === g.id) }))
    .concat([{ group: { id: null, name: 'Independent' }, items: rows.filter((r: any) => !r.group_id) }])
    .filter((b: any) => b.items.length);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium">Portfolio</h1>
          <p className="text-[12px] text-faint">
            Where every property stands, and what is holding it up.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/clients/new">
            <Plus className="h-3.5 w-3.5" /> New client
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="In flight" value={inFlight.length} sub={`${rows.length} total`} />
        <Metric label="Live" value={live.length} sub="onboarded or done" />
        <Metric
          label="Open blockers"
          value={blockers.length}
          sub={`${blockers.filter((b: any) => b.is_overdue).length} past ETA`}
          href="/blockers"
          tone={blockers.some((b: any) => b.is_overdue) ? 'bad' : undefined}
        />
        <Metric
          label="Past onboarding date"
          value={overdue.length}
          tone={overdue.length ? 'bad' : undefined}
          sub="still in flight"
        />
        <Metric
          label="Properties at risk"
          value={atRisk.length}
          sub="go-live within 30d"
          tone={atRisk.length ? 'bad' : undefined}
        />
        <Metric label="Devices blocked" value={blockedDevices} href="/devices" />
      </div>

      <StageDriftBanner stale={stale} />
      <DriftBanner drift={drift} />
      <GoLiveWatch gates={gates} />

      {bucketed.map(({ group, items }: any) => {
        // Leads sit behind a fold — they are prospects, not work in flight.
        const leads = items.filter((i: any) => i.stage === 'lead');
        const active = items.filter((i: any) => i.stage !== 'lead');

        const row = (r: any) => {
          const rd: any = ready.get(r.id);
          return (
            <tr key={r.id} className="align-middle hover:bg-soft">
              <td className="px-4 py-2.5">
                <Link href={`/property/${r.slug}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <div className="text-[11px] text-faint">
                  {[r.city, r.prefecture].filter(Boolean).join(', ') || '—'}
                </div>
              </td>
              <td className="px-4 py-2.5">
                <StagePill stage={r.stage} />
              </td>
              <td className="px-4 py-2.5">
                <div>{fmtDate(r.onboarding_date)}</div>
                {r.days_to_onboarding !== null && r.stage !== 'done' && r.stage !== 'onboarded' && (
                  <div
                    className={
                      isPastDue(r) ? 'text-[11px] text-destructive' : 'text-[11px] text-faint'
                    }
                  >
                    {r.days_to_onboarding < 0
                      ? `${Math.abs(r.days_to_onboarding)}d over`
                      : `in ${r.days_to_onboarding}d`}
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5">
                <Progress done={r.checklist_done || 0} total={r.checklist_total || 0} />
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  <StatePill state={rd?.pms_readiness || 'unknown'} />
                  {rd?.devices_stuck > 0 && <Pill tone="bad">{rd.devices_stuck} stuck</Pill>}
                </div>
              </td>
              <td className="px-4 py-2.5">
                {r.top_blocker_title ? (
                  <div className="max-w-[16rem]">
                    <div className="truncate">{r.top_blocker_title}</div>
                    <div className="text-[11px] text-faint">
                      {r.open_blocker_count} open
                      {r.overdue_blocker_count > 0 && ` · ${r.overdue_blocker_count} past ETA`}
                    </div>
                  </div>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-[11px] text-faint">{ago(r.last_activity_at)}</td>
            </tr>
          );
        };

        return (
          <Card key={group.id || 'independent'}>
            <CardHeader
              title={group.name}
              sub={
                plural(items.length, 'property', 'properties') +
                (leads.length ? ` · ${plural(leads.length, 'lead')}` : '')
              }
              right={
                <span className="text-[11px] text-faint">
                  {items.filter((i: any) => i.open_blocker_count > 0).length} with open blockers
                </span>
              }
            />
            <TableWrap>
              <table className="w-full min-w-[52rem] text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-wide text-faint">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-normal">Property</th>
                    <th className="px-4 py-2 font-normal">Stage</th>
                    <th className="px-4 py-2 font-normal">Onboarding</th>
                    <th className="px-4 py-2 font-normal">Checklist</th>
                    <th className="px-4 py-2 font-normal">Readiness</th>
                    <th className="px-4 py-2 font-normal">Top blocker</th>
                    <th className="px-4 py-2 font-normal">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">{active.map(row)}</tbody>
                <LeadFold count={leads.length} colSpan={7}>
                  {leads.map(row)}
                </LeadFold>
              </table>
            </TableWrap>
          </Card>
        );
      })}

      {!rows.length && (
        <Card>
          <Empty>No properties yet. Add your first client to get started.</Empty>
        </Card>
      )}
    </main>
  );
}
