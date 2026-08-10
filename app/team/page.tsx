import Link from 'next/link';
import { getTeam, getRampTasks, getAllBlockers, getAllMeetings } from '@/lib/data';
import { RAMP_STATES } from '@/lib/enums';
import { setRampTaskState } from '@/lib/actions';
import { Card, CardHeader, Empty, Pill } from '@/components/ui';
import { enumOptions } from '@/lib/ui-helpers';
import { QuickSelect } from '@/components/quick-edit';
import { Metric, Progress, ago, fmtDate } from '@/components/shared';

export const dynamic = 'force-dynamic';

/**
 * Not a task assignment tool. This is the "what are Reza and Rido on, and where
 * is Reza's ramp-up" view — enough surface area to step in, nothing more.
 */
export default async function Team() {
  const [team, ramp, blockers, meetings] = await Promise.all([
    getTeam(), getRampTasks(), getAllBlockers(), getAllMeetings()
  ]);

  const rampBy: Record<string, any[]> = {};
  ramp.forEach((t: any) => (rampBy[t.member_id] = rampBy[t.member_id] || []).push(t));

  const now = Date.now();
  const upcoming = meetings.filter(
    (m: any) => m.state === 'scheduled' && new Date(m.starts_at).getTime() >= now
  );

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">Team</h1>
        <p className="text-[12px] text-faint">
          Who is carrying what, and how the new joiners are ramping.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="People" value={team.length} />
        <Metric label="Open blockers" value={blockers.length} href="/blockers" />
        <Metric
          label="Unowned blockers"
          value={blockers.filter((b: any) => !b.owner_name).length}
          tone={blockers.some((b: any) => !b.owner_name) ? 'bad' : undefined}
        />
        <Metric label="Upcoming meetings" value={upcoming.length} href="/meetings" />
      </div>

      {team.map((m: any) => {
        const tasks = rampBy[m.id] || [];
        const done = tasks.filter((t: any) => ['done', 'skipped'].includes(t.state)).length;
        const mine = blockers.filter((b: any) => b.owner_name === m.short_name || b.owner_name === m.full_name);
        const theirMeetings = upcoming.filter((x: any) =>
          (x.attendees || []).some((a: string) => a === m.short_name || a === m.full_name)
        );
        // Someone who started in the last 60 days gets the ramp panel whether or
        // not a template exists for their role — otherwise a new joiner with no
        // template silently looks like a veteran.
        const isNewJoiner =
          !!m.started_on &&
          (Date.now() - new Date(m.started_on).getTime()) / 86_400_000 <= 60;

        return (
          <Card key={m.id}>
            <CardHeader
              title={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {m.full_name}
                  <Pill>{String(m.role).replace(/_/g, ' ')}</Pill>
                  {m.started_on && <span className="text-[11px] font-normal text-faint">since {fmtDate(m.started_on)}</span>}
                </span>
              }
              sub={`${m.properties_owned || 0} propert${m.properties_owned === 1 ? 'y' : 'ies'} · last active ${ago(m.last_activity_at)}`}
              right={tasks.length > 0 ? <Progress done={done} total={tasks.length} /> : undefined}
            />

            <div className="grid gap-0 divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <div>
                <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-faint">
                  Open blockers ({mine.length})
                </div>
                <ul className="divide-y divide-line">
                  {mine.slice(0, 8).map((b: any) => (
                    <li key={b.id} className="px-4 py-2">
                      <div className="text-[13px]">{b.title}</div>
                      <div className="text-[11px] text-faint">
                        <Link href={`/property/${b.property_slug}`} className="underline">
                          {b.property_name}
                        </Link>
                        {b.eta ? ` · ETA ${fmtDate(b.eta)}` : ''}
                        {b.is_overdue ? ' · past ETA' : ''}
                      </div>
                    </li>
                  ))}
                  {!mine.length && <Empty>Nothing assigned.</Empty>}
                </ul>
              </div>

              <div>
                <div className="px-4 py-2 text-[11px] uppercase tracking-wide text-faint">
                  {isNewJoiner ? 'First week homework' : 'Upcoming meetings'}
                </div>
                {isNewJoiner && !tasks.length && (
                  <Empty>
                    No ramp template for the {String(m.role).replace(/_/g, ' ')} role yet, so nothing
                    is being tracked for {m.short_name || m.full_name}.
                  </Empty>
                )}
                {tasks.length > 0 ? (
                  <ul className="divide-y divide-line">
                    {tasks.map((t: any) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                        <div className="min-w-0">
                          <div className="text-[13px]">{t.title}</div>
                          <div className="text-[11px] text-faint">
                            {t.category?.replace(/_/g, ' ')}
                            {t.due_on ? ` · due ${fmtDate(t.due_on)}` : ''}
                            {t.is_overdue ? ' · overdue' : ''}
                          </div>
                        </div>
                        <QuickSelect
                          value={t.state}
                          options={enumOptions(RAMP_STATES)}
                          onSave={setRampTaskState.bind(null, t.id, t.title)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : isNewJoiner ? null : (
                  <ul className="divide-y divide-line">
                    {theirMeetings.slice(0, 6).map((x: any) => (
                      <li key={x.id} className="px-4 py-2">
                        <div className="text-[13px]">{x.title}</div>
                        <div className="text-[11px] text-faint">
                          {x.property_name} · {fmtDate(x.starts_at)}
                        </div>
                      </li>
                    ))}
                    {!theirMeetings.length && <Empty>Nothing scheduled.</Empty>}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {!team.length && (
        <Card>
          <Empty>No team members recorded.</Empty>
        </Card>
      )}
    </main>
  );
}
