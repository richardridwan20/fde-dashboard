import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import {
  getProperty, getPropertyBlockers, getPropertyIntegrations, getIntegrationTypes,
  getPropertyChecklist, getPropertyPhotos, getPropertyActivity, getPropertyTasks,
  getPropertyDrift, getPropertyMeetings, getReadiness, getWorkstreams,
  getPropertyGate, STAGES
} from '@/lib/data';
import { DEVICE_STATUSES } from '@/lib/enums';
import { setDeviceStatus, removeDevice, setOnboardingDate, setStage } from '@/lib/actions';
import { Button, Card, CardHeader, Empty, Pill } from '@/components/ui';
import { activityState, enumOptions, plural } from '@/lib/ui-helpers';
import { QuickDate, QuickSelect, ConfirmButton } from '@/components/quick-edit';
import {
  ClickupRow, DeviceCard, MapEmbed, Metric, Progress, ago, fmtDate, fmtDateTime
} from '@/components/shared';
import { Checklist } from '@/components/checklist';
import { GatePanel } from '@/components/go-live';
import { Paginated } from '@/components/paginate';
import { PhotoGrid } from '@/components/photo-grid';
import { ReadinessPanel } from '@/components/readiness-panel';
import { BlockerCard } from '@/components/property-blockers';
import { BlockerDialog } from '@/components/forms/blocker-dialog';
import { DeviceDialog } from '@/components/forms/device-dialog';
import { MeetingDialog } from '@/components/forms/meeting-dialog';
import { PhotoUpload } from '@/components/forms/photo-upload';
import { ClientDetailsDialog } from '@/components/forms/client-details-dialog';

export const dynamic = 'force-dynamic';

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property) notFound();

  const [
    blockers, devices, types, checklist, photos, activity, tasks, drift, meetings, readiness,
    workstreams, gate
  ] = await Promise.all([
    getPropertyBlockers(property.id),
    getPropertyIntegrations(property.id),
    getIntegrationTypes(),
    getPropertyChecklist(property.id),
    getPropertyPhotos(property.id),
    getPropertyActivity(property.id),
    getPropertyTasks(property.id),
    getPropertyDrift(slug),
    getPropertyMeetings(property.id),
    getReadiness(),
    getWorkstreams(),
    getPropertyGate(property.id)
  ]);

  const rd: any = readiness.find((r: any) => r.property_id === property.id) || {};
  const driftBy: Record<string, any[]> = {};
  drift.forEach((d: any) => (driftBy[d.blocker_id] = driftBy[d.blocker_id] || []).push(d));
  const open = blockers.filter((b: any) => b.state !== 'resolved');
  const resolved = blockers.filter((b: any) => b.state === 'resolved');

  const detail = (label: string, value?: React.ReactNode) => (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-faint">{label}</dt>
      <dd className="text-[13px]">{value || <span className="text-faint">—</span>}</dd>
    </div>
  );

  return (
    <main className="space-y-6">
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] text-faint">
            <Link href="/" className="hover:underline">
              Portfolio
            </Link>
            {property.group_name ? ` · ${property.group_name}` : ''}
          </div>
          <h1 className="text-lg font-medium">{property.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
            {property.fde_owner && <Pill>FDE {property.fde_owner}</Pill>}
            {property.pic_wasimil && <Pill>PIC {property.pic_wasimil}</Pill>}
            <span>last activity {ago(property.last_activity_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuickSelect
            value={property.stage}
            options={STAGES.map((s) => ({ value: s.key, label: s.label }))}
            onSave={setStage.bind(null, property.id)}
          />
          <QuickDate value={property.onboarding_date} onSave={setOnboardingDate.bind(null, property.id)} />
          <ClientDetailsDialog property={property} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Open blockers"
          value={open.length}
          tone={property.overdue_blocker_count > 0 ? 'bad' : undefined}
          sub={property.overdue_blocker_count > 0 ? `${property.overdue_blocker_count} past ETA` : 'none past ETA'}
        />
        <Metric label="Devices" value={property.integration_count || 0} sub={`${property.integration_blocked || 0} blocked`} />
        <Metric label="Checklist" value={`${property.checklist_done || 0}/${property.checklist_total || 0}`} />
        {/* "9d over" on a finished property reads as a miss it is not. */}
        <Metric label="Onboarding" value={fmtDate(property.onboarding_date)} sub={
          property.days_to_onboarding === null
            ? 'no date set'
            : property.stage === 'done' || property.stage === 'onboarded'
              ? String(property.stage).replace(/_/g, ' ')
              : property.days_to_onboarding < 0
                ? `${Math.abs(property.days_to_onboarding)}d over`
                : `in ${property.days_to_onboarding}d`
        } />
      </div>

      {/* -------------------------------------------------------- go-live gate */}
      <GatePanel gate={gate} />

      {/* --------------------------------------------------- client details */}
      <Card>
        <CardHeader title="Client details" right={<ClientDetailsDialog property={property} />} />
        <div className="p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {detail('Contact', property.contact_person)}
            {detail('Hotel PIC', property.pic_hotel_staff)}
            {detail('Postal code', property.postal_code)}
            {detail('City', [property.city, property.prefecture].filter(Boolean).join(', '))}
            <div className="col-span-2 sm:col-span-3">
              {detail('Address', property.address)}
              {property.address_ja && <div className="text-[12px] text-sub">{property.address_ja}</div>}
            </div>
            {detail(
              'Website',
              property.website_url && (
                <a
                  href={property.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  visit <ExternalLink className="h-3 w-3" />
                </a>
              )
            )}
          </dl>
          <div className="mt-4">
            <MapEmbed property={property} />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------------------------------ readiness */}
        <Card>
          <CardHeader
            title="Readiness"
            sub="Manual until the Hasura connector lands"
            right={rd.all_ready ? <Pill tone="good">all ready</Pill> : undefined}
          />
          <ReadinessPanel property={{ ...rd, id: property.id }} />
        </Card>

        {/* -------------------------------------------------------- devices */}
        <Card>
          <CardHeader
            title="Devices"
            right={<DeviceDialog propertyId={property.id} types={types} />}
          />
          <div className="divide-y divide-line">
            {devices.map((d: any) => (
              <DeviceCard key={d.id} d={d}>
                <QuickSelect
                  value={d.status}
                  options={enumOptions(DEVICE_STATUSES)}
                  onSave={setDeviceStatus.bind(null, d.id)}
                />
                <ConfirmButton onConfirm={removeDevice.bind(null, d.id)} confirmLabel="Confirm remove">
                  remove
                </ConfirmButton>
              </DeviceCard>
            ))}
            {!devices.length && <Empty>No devices recorded for this property.</Empty>}
          </div>
        </Card>
      </div>

      {/* -------------------------------------------------------- blockers */}
      <Card>
        <CardHeader
          title="Blockers"
          sub={`${open.length} open`}
          right={
            <BlockerDialog
              propertyId={property.id}
              devices={types}
              workstreams={workstreams}
            />
          }
        />
        <div className="divide-y divide-line">
          {open.map((b: any) => (
            <BlockerCard key={b.id} b={b} drift={driftBy[b.id]} workstreams={workstreams} />
          ))}
          {!open.length && <Empty>Nothing is blocked right now.</Empty>}
        </div>
        {resolved.length > 0 && (
          <details className="border-t border-line px-4 py-2.5">
            <summary className="cursor-pointer list-none text-[12px] text-sub underline decoration-dotted">
              Resolved ({resolved.length})
            </summary>
            <ul className="mt-2 space-y-1 text-[12px] text-faint">
              {resolved.map((b: any) => (
                <li key={b.id}>
                  {b.title} · {fmtDate(b.resolved_at)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {/* ------------------------------------------------------- checklist */}
      <Card>
        <CardHeader
          title="Onboarding checklist"
          right={<Progress done={property.checklist_done || 0} total={property.checklist_total || 0} />}
        />
        <Checklist propertyId={property.id} items={checklist} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------------------------------ meetings */}
        <Card>
          <CardHeader
            title="Activities"
            sub={meetings.length > 6 ? `showing 6 of ${meetings.length}` : undefined}
            right={
              <MeetingDialog propertyId={property.id} workstreams={workstreams} />
            }
          />
          <div className="divide-y divide-line">
            {meetings.slice(0, 6).map((m: any) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <Link href={`/meetings?id=${m.id}`} className="text-[13px] hover:underline">
                    {m.title}
                  </Link>
                  <div className="text-[11px] text-faint">
                    {fmtDateTime(m.starts_at)} · {m.kind.replace(/_/g, ' ')}
                    {m.has_notes ? ' · notes' : ''}
                    {m.photo_count > 0 ? ` · ${plural(m.photo_count, 'photo')}` : ''}
                    {/* Inherited from the group, not specific to this property —
                        editing it here changes what every member property sees. */}
                    {m.is_group ? ` · shared with ${plural(m.group_property_count, 'property', 'properties')} in ${m.group_name}` : ''}
                  </div>
                </div>
                <Pill tone={m.state === 'held' ? 'good' : m.state === 'cancelled' ? 'bad' : 'info'}>
                  {activityState(m.kind, m.state)}
                </Pill>
              </div>
            ))}
            {!meetings.length && (
              <Empty>Nothing recorded yet — meetings, migrations, installs and site visits all live here.</Empty>
            )}
          </div>
        </Card>

        {/* -------------------------------------------------------- clickup */}
        <Card>
          <CardHeader title="ClickUp" sub={plural(tasks.length, 'linked task')} />
          <div className="max-h-80 divide-y divide-line overflow-y-auto">
            {tasks.slice(0, 20).map((t: any) => (
              <ClickupRow key={t.id} t={t} />
            ))}
            {!tasks.length && <Empty>No tasks matched to this property.</Empty>}
          </div>
        </Card>
      </div>

      {/* ---------------------------------------------------------- photos */}
      <Card>
        {/* No count here — PhotoGrid's own toolbar already prints it. */}
        <CardHeader
          title="Photos"
          right={<PhotoUpload propertyId={property.id} devices={devices} meetings={meetings} />}
        />
        <PhotoGrid photos={photos} />
      </Card>

      {/* -------------------------------------------------------- activity */}
      <Card>
        <CardHeader title="Recent activity" sub={plural(activity.length, 'event')} />
        <Paginated
          noun="events"
          empty="Nothing recorded yet."
          items={activity.map((a: any) => (
            <li key={a.id} className="px-4 py-2.5">
              <div className="text-[13px]">{a.summary}</div>
              <div className="text-[11px] text-faint">
                {ago(a.occurred_at)} · {a.source}
                {a.actor_name ? ` · ${a.actor_name}` : ''}
              </div>
            </li>
          ))}
        />
      </Card>

      <div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Back to portfolio</Link>
        </Button>
      </div>
    </main>
  );
}
