import Link from 'next/link';
import {
  getOverview, getBlockersForReport, getPropertyTasks, getPropertyMeetings, getWeeklyNarrative
} from '@/lib/data';
import { buildReport, isoDate, mondayOf, weekLabel, weekStartFrom } from '@/lib/report';
import { Card, CardHeader, Empty } from '@/components/ui';
import { ReportPanel } from '@/components/report-panel';
import { NARRATIVE_READY } from '@/lib/config';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * The weekly status you currently hand-write. SHIPPED and IN PROGRESS come from
 * blockers and ClickUp; the four narrative sections are yours and persist per
 * property per week.
 */
export default async function Reports({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const clients = await getOverview();

  const property = clients.find((c: any) => c.slug === sp?.slug) || clients[0];
  if (!property) {
    return (
      <main>
        <Card>
          <Empty>Add a client before generating a report.</Empty>
        </Card>
      </main>
    );
  }

  const weekStart = weekStartFrom(sp?.week);
  const weekIso = isoDate(weekStart);

  const [blockers, tasks, meetings, narrative] = await Promise.all([
    getBlockersForReport(property.id),
    getPropertyTasks(property.id),
    getPropertyMeetings(property.id),
    getWeeklyNarrative(property.id, weekIso)
  ]);

  const markdown = buildReport({
    property: { name: property.name },
    weekStart,
    narrative: narrative || {},
    blockers,
    tasks,
    meetings
  });

  const shift = (weeks: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + weeks * 7);
    return isoDate(d);
  };

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">Weekly report</h1>
        <p className="text-[12px] text-faint">
          SHIPPED and IN PROGRESS are derived live from blockers and ClickUp. The four narrative sections are yours.
        </p>
      </div>

      <Card>
        <CardHeader
          title={`${property.name} — week of ${weekLabel(weekStart)}`}
          sub={narrative ? 'Narrative saved for this week' : 'No narrative written for this week yet'}
          right={
            <div className="flex items-center gap-2 text-[12px]">
              <Link href={`/reports?slug=${property.slug}&week=${shift(-1)}`} className="underline">
                ← previous
              </Link>
              <Link href={`/reports?slug=${property.slug}&week=${isoDate(mondayOf())}`} className="underline">
                this week
              </Link>
              <Link href={`/reports?slug=${property.slug}&week=${shift(1)}`} className="underline">
                next →
              </Link>
            </div>
          }
        />

        <div className="flex flex-wrap gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-[12px]">
          {clients.map((c: any) => (
            <Link
              key={c.id}
              href={`/reports?slug=${c.slug}&week=${weekIso}`}
              className={cn(
                'hover:underline',
                c.id === property.id ? 'font-medium text-ink' : 'text-sub'
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>

        <div className="p-4">
          <ReportPanel
            canDraft={NARRATIVE_READY}
            markdown={markdown}
            propertyId={property.id}
            weekStart={weekIso}
            narrative={narrative}
          />
        </div>
      </Card>
    </main>
  );
}
