import Link from 'next/link';
import { getAllIntegrations, getIntegrationTypes, getReadiness } from '@/lib/data';
import { DEVICE_STATUSES } from '@/lib/enums';
import { setDeviceStatus } from '@/lib/actions';
import { Card, CardHeader, Empty, Pill } from '@/components/ui';
import { enumOptions } from '@/lib/ui-helpers';
import { QuickSelect } from '@/components/quick-edit';
import { DeviceIcon, Metric, StatePill, ago } from '@/components/shared';

export const dynamic = 'force-dynamic';

/** Grouped by device type rather than by property: this is the view you want
 *  when one integration is failing everywhere, which is the usual shape. */
export default async function Devices() {
  const [rows, types, readiness] = await Promise.all([
    getAllIntegrations(), getIntegrationTypes(), getReadiness()
  ]);

  const byType = types
    .map((t: any) => ({ type: t, items: rows.filter((r: any) => r.integration_key === t.key) }))
    .filter((g: any) => g.items.length);

  const stuck = rows.filter((r: any) => ['blocked', 'degraded'].includes(r.status));
  const live = rows.filter((r: any) => r.status === 'live');

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">Devices</h1>
        <p className="text-[12px] text-faint">Integration status per device, across every property.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Installed" value={rows.length} />
        <Metric label="Live" value={live.length} />
        <Metric label="Blocked or degraded" value={stuck.length} tone={stuck.length ? 'bad' : undefined} />
        <Metric label="Properties all ready" value={readiness.filter((r: any) => r.all_ready).length} />
      </div>

      {byType.map(({ type, items }: any) => (
        <Card key={type.key}>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <DeviceIcon icon={type.icon} />
                {type.label}
              </span>
            }
            sub={type.description}
            right={
              <span className="text-[11px] text-faint">
                {items.filter((i: any) => i.status === 'live').length}/{items.length} live
              </span>
            }
          />
          <div className="divide-y divide-line">
            {items.map((d: any) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <Link href={`/property/${d.property_slug}`} className="text-[13px] hover:underline">
                    {d.property_slug}
                  </Link>
                  <div className="text-[11px] text-faint">
                    {d.vendor_label || d.device_type || '—'}
                    {d.open_blockers > 0 && ` · ${d.open_blockers} open blocker${d.open_blockers > 1 ? 's' : ''}`}
                    {d.last_bridge_report && ` · reported ${ago(d.last_bridge_report)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.open_blockers > 0 && <Pill tone="bad">{d.open_blockers}</Pill>}
                  <QuickSelect
                    value={d.status}
                    options={enumOptions(DEVICE_STATUSES)}
                    onSave={(v) => setDeviceStatus(d.id, v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {!rows.length && (
        <Card>
          <Empty>No devices recorded yet.</Empty>
        </Card>
      )}

      <Card>
        <CardHeader title="Readiness by property" sub="PMS, channel manager and payment gateway" />
        <div className="divide-y divide-line">
          {readiness.map((r: any) => (
            <div key={r.property_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <Link href={`/property/${r.slug}`} className="text-[13px] hover:underline">
                {r.name}
              </Link>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-faint">
                <span className="inline-flex items-center gap-1">
                  PMS <StatePill state={r.pms_readiness || 'unknown'} />
                </span>
                <span className="inline-flex items-center gap-1">
                  CM <StatePill state={r.channel_manager || 'unknown'} />
                </span>
                <span className="inline-flex items-center gap-1">
                  Pay <StatePill state={r.payment_gateway || 'unknown'} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
