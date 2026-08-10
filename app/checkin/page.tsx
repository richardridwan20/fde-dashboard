import Link from 'next/link';
import {
  getCheckinSteps, getCheckinFunnel, getCheckinFailures, getOverview
} from '@/lib/data';
import { Card, CardHeader, Empty, Pill } from '@/components/ui';
import { Metric, fmtDateTime } from '@/components/shared';
import { plural } from '@/lib/ui-helpers';
import { CHECKIN_INGEST_READY } from '@/lib/config';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 14;

/**
 * Where check-in is breaking, by property and by step.
 *
 * The schema for this shipped with the port and nothing ever wrote to it, so
 * the page did not exist. It exists now because there is an ingest endpoint —
 * but it still renders an honest "no events" state rather than a fake funnel,
 * because a made-up conversion rate is worse than an empty page.
 */
export default async function Checkin({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const sinceIso = since.toISOString().slice(0, 10);

  const [steps, funnel, failures, properties] = await Promise.all([
    getCheckinSteps(), getCheckinFunnel(sinceIso), getCheckinFailures(), getOverview()
  ]);

  const slug = sp?.property || null;
  const rows = slug ? funnel.filter((f: any) => f.property_slug === slug) : funnel;
  const fails = slug ? failures.filter((f: any) => f.property_slug === slug) : failures;

  // Roll the daily rows up per step across the window.
  const byStep = steps.map((s: any) => {
    const mine = rows.filter((r: any) => r.step_key === s.key);
    const entered = mine.reduce((n: number, r: any) => n + (r.entered_count || 0), 0);
    const completed = mine.reduce((n: number, r: any) => n + (r.completed_count || 0), 0);
    const failed = mine.reduce((n: number, r: any) => n + (r.failed_count || 0), 0);
    const abandoned = mine.reduce((n: number, r: any) => n + (r.abandoned_count || 0), 0);
    return {
      ...s,
      entered,
      completed,
      failed,
      abandoned,
      pct: entered > 0 ? Math.round((1000 * completed) / entered) / 10 : null
    };
  });

  const top = byStep[0]?.entered || 0;
  const totalEntered = byStep.reduce((n: number, s: any) => n + s.entered, 0);
  const totalFailed = byStep.reduce((n: number, s: any) => n + s.failed, 0);
  // The step where the most people stop — the answer to "where is it breaking".
  const worst = byStep
    .filter((s: any) => s.entered > 0 && s.pct !== null)
    .sort((a: any, b: any) => a.pct - b.pct)[0];

  const withData = properties.filter((p: any) =>
    funnel.some((f: any) => f.property_id === p.id)
  );

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">Check-in</h1>
        <p className="text-[12px] text-faint">
          Where guest check-in stalls or fails, by property and by step. Last {WINDOW_DAYS} days.
        </p>
      </div>

      {totalEntered === 0 ? (
        <Card>
          <CardHeader
            title="No check-in events yet"
            right={
              <Pill tone={CHECKIN_INGEST_READY ? 'good' : 'warn'}>
                {CHECKIN_INGEST_READY ? 'ingest configured' : 'ingest not configured'}
              </Pill>
            }
          />
          <div className="space-y-3 px-4 py-4 text-[13px] text-sub">
            <p>
              The funnel tables are empty. The {plural(steps.length, 'step')} below are defined and
              ready to receive data — nothing has sent any.
            </p>
            <ul className="ml-4 list-disc space-y-1 text-[12px]">
              {steps.map((s: any) => (
                <li key={s.key}>
                  {s.step_order}. {s.label}{' '}
                  <code className="text-[11px] text-faint">{s.key}</code>
                  {s.is_terminal && <span className="text-faint"> · terminal</span>}
                </li>
              ))}
            </ul>
            <p className="text-[12px]">
              The kiosk bridge can post daily step rollups and individual failures to{' '}
              <code className="text-[11px]">POST /api/checkin/ingest</code> with a bearer token.
              {CHECKIN_INGEST_READY
                ? ' The endpoint is live and accepting writes.'
                : ' Set CHECKIN_INGEST_TOKEN and SUPABASE_SERVICE_ROLE_KEY in Vercel to switch it on.'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Started check-in" value={top} sub={`last ${WINDOW_DAYS} days`} />
            <Metric
              label="Reached the end"
              value={byStep.filter((s: any) => s.is_terminal).reduce((n: number, s: any) => n + s.completed, 0)}
            />
            <Metric
              label="Failures"
              value={totalFailed}
              tone={totalFailed ? 'bad' : undefined}
            />
            <Metric
              label="Worst step"
              value={worst ? `${worst.pct}%` : '—'}
              sub={worst ? worst.label : 'nothing measured'}
              tone={worst && worst.pct < 80 ? 'bad' : undefined}
            />
          </div>

          {withData.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-faint">Property:</span>
              <Link
                href="/checkin"
                className={!slug ? 'font-medium text-ink' : 'text-sub underline'}
              >
                all
              </Link>
              {withData.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/checkin?property=${p.slug}`}
                  className={slug === p.slug ? 'font-medium text-ink' : 'text-sub underline'}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}

          <Card>
            <CardHeader title="Funnel" sub="Share of everyone who entered each step and finished it" />
            <div className="divide-y divide-line">
              {byStep.map((s: any) => (
                <div key={s.key} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px]">
                      {s.step_order}. {s.label}
                    </span>
                    <span className="text-[11px] text-faint">
                      {s.entered === 0
                        ? 'no traffic'
                        : `${s.completed} of ${s.entered} · ${s.pct}%` +
                          (s.failed ? ` · ${plural(s.failed, 'failure')}` : '') +
                          (s.abandoned ? ` · ${s.abandoned} abandoned` : '')}
                    </span>
                  </div>
                  {/* Bars are relative to the top of the funnel, so drop-off is visible. */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-soft">
                    <div
                      className={s.failed > 0 ? 'h-full bg-destructive/60' : 'h-full bg-primary/70'}
                      style={{ width: top > 0 ? `${Math.min(100, (100 * s.entered) / top)}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent failures" sub={`${fails.length} recorded`} />
            <div className="divide-y divide-line">
              {fails.slice(0, 25).map((f: any) => (
                <div key={f.id} className="px-4 py-2.5">
                  <div className="text-[13px]">
                    {f.step_label || f.step_key}
                    {f.error_code ? <span className="text-faint"> · {f.error_code}</span> : ''}
                  </div>
                  <div className="text-[11px] text-faint">
                    <Link href={`/property/${f.property_slug}`} className="hover:underline">
                      {f.property_name}
                    </Link>{' '}
                    · {fmtDateTime(f.occurred_at)}
                    {f.external_booking_id ? ` · booking ${f.external_booking_id}` : ''}
                  </div>
                  {f.error_message && (
                    <div className="mt-0.5 text-[12px] text-sub">{f.error_message}</div>
                  )}
                </div>
              ))}
              {!fails.length && <Empty>No failures recorded in this window.</Empty>}
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
