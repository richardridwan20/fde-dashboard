import Link from 'next/link';
import { getAllBlockers, getResolvedBlockers, getOverview, getDrift, getIntegrationTypes, getWorkstreams, SEVERITIES } from '@/lib/data';
import { Card, SeverityLegend } from '@/components/ui';
import { DriftBanner } from '@/components/clickup';
import { BlockerCard } from '@/components/property-blockers';
import { BlockerDialog } from '@/components/forms/blocker-dialog';
import { WaitingOnClient } from '@/components/waiting-on-client';

export const dynamic = 'force-dynamic';

export default async function Blockers({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const sort = sp?.sort || 'eta';
  const [all, resolved, clients, drift, types, workstreams] = await Promise.all([
    getAllBlockers(), getResolvedBlockers(), getOverview(), getDrift(), getIntegrationTypes(), getWorkstreams()
  ]);
  const driftBy: Record<string, any[]> = {};
  drift.forEach((d: any) => (driftBy[d.blocker_id] = driftBy[d.blocker_id] || []).push(d));

  const sorted = [...all].sort((a: any, b: any) => {
    if (sort === 'severity') {
      // indexOf returns -1 for anything outside the enum, which sorted unknown
      // severities above critical. Push them to the end instead.
      const rank = (s: string) => (SEVERITIES.indexOf(s) === -1 ? 99 : SEVERITIES.indexOf(s));
      return rank(a.severity) - rank(b.severity);
    }
    if (sort === 'age') return b.age_days - a.age_days;
    if (sort === 'waiting') return (b.waiting_days ?? -1) - (a.waiting_days ?? -1);
    return (a.eta || '9999').localeCompare(b.eta || '9999');
  });
  const overdue = sorted.filter((b: any) => b.is_overdue);
  const onTrack = sorted.filter((b: any) => !b.is_overdue);
  // Longest silence first — the question is "what has gone quiet", not "what is newest".
  const waiting = [...all]
    .filter((b: any) => b.state === 'blocked_on_client')
    .sort((a: any, b: any) => (b.waiting_days ?? 0) - (a.waiting_days ?? 0));

  const Group = ({ title, items, empty }: any) => (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-medium">{title}</h2><span className="text-[12px] text-faint">{items.length}</span>
      </div>
      <Card className="divide-y divide-line">
        {items.map((b: any) => (
          <div key={b.id}>
            <div className="px-4 pt-3 text-[12px] text-sub">
              <Link href={'/property/' + b.property_slug} className="text-ink hover:underline">{b.property_name}</Link>
              {b.integration_label ? ' · ' + b.integration_label : ''}
            </div>
            <BlockerCard b={b} drift={driftBy[b.id]} workstreams={workstreams} />
          </div>
        ))}
        {items.length === 0 && <div className="px-4 py-6 text-[13px] text-faint">{empty}</div>}
      </Card>
    </section>
  );

  return (
    <main>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-medium">Blockers</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[12px] text-sub">Sort:{' '}
            {['eta','severity','age','waiting'].map((s) => (
              <Link key={s} href={'/blockers?sort=' + s} className={'ml-2 ' + (sort === s ? 'font-medium text-ink' : 'underline')}>{s}</Link>
            ))}
          </div>
          <BlockerDialog propertyId={null} clients={clients} devices={types} workstreams={workstreams} />
        </div>
      </div>
      <div className="mb-4 text-[12px] text-faint">Edit inline. Every change is recorded. <SeverityLegend /></div>

      <div className="mb-6"><DriftBanner drift={drift} /></div>

      <WaitingOnClient items={waiting} />

      <Group title="Past ETA" items={overdue} empty="Nothing is past its committed date." />
      <Group title="Within ETA" items={onTrack} empty="No blockers are still within their committed date." />

      {resolved.length > 0 && (
        <details>
          <summary className="cursor-pointer list-none text-[12px] text-sub underline decoration-dotted">Recently resolved ({resolved.length})</summary>
          <Card className="mt-3 divide-y divide-line">
            {resolved.map((b: any) => (
              <div key={b.id} className="px-4 py-2.5">
                <div className="text-[13px] text-sub">{b.title}</div>
                <div className="text-[11px] text-faint">{b.property_name} · {b.age_days}d</div>
              </div>
            ))}
          </Card>
        </details>
      )}
    </main>
  );
}