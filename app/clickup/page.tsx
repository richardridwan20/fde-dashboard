import { getClickupTasks, getDrift, getSyncExceptions } from '@/lib/data';
import { Card, CardHeader, Empty, Pill } from '@/components/ui';
import { DriftBanner } from '@/components/clickup';
import { ClickupRow, Metric, ago } from '@/components/shared';
import { plural } from '@/lib/ui-helpers';

export const dynamic = 'force-dynamic';

export default async function Clickup() {
  const [tasks, drift, exceptions] = await Promise.all([
    getClickupTasks(), getDrift(), getSyncExceptions()
  ]);

  const open = tasks.filter((t: any) => !['done', 'passed_testing'].includes(t.state));
  const done = tasks.filter((t: any) => ['done', 'passed_testing'].includes(t.state));
  const unmatched = tasks.filter((t: any) => !t.property_id);
  const synced = tasks[0]?.synced_at;

  const byState: Record<string, any[]> = {};
  open.forEach((t: any) => (byState[t.state] = byState[t.state] || []).push(t));

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">ClickUp</h1>
        <p className="text-[12px] text-faint">
          Synced tasks, matched to properties. Last sync {ago(synced)}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Open tasks" value={open.length} sub={`${tasks.length} synced`} />
        <Metric label="Disagree with blockers" value={drift.length} tone={drift.length ? 'bad' : undefined} />
        <Metric label="Unmatched" value={unmatched.length} sub="no property" />
        <Metric label="Sync exceptions" value={exceptions.length} tone={exceptions.length ? 'bad' : undefined} />
      </div>

      <DriftBanner drift={drift} />

      {Object.entries(byState).map(([state, items]) => (
        <Card key={state}>
          <CardHeader title={state.replace(/_/g, ' ')} sub={plural(items.length, 'task')} />
          <div className="divide-y divide-line">
            {items.map((t: any) => (
              <ClickupRow key={t.id} t={t} />
            ))}
          </div>
        </Card>
      ))}

      {/* Without this the page went blank whenever every synced task was
          finished — stat cards and nothing else, which reads as "the sync is
          broken" rather than "everything is done". */}
      {open.length === 0 && tasks.length > 0 && (
        <Card>
          <CardHeader title="Nothing open" sub="Every synced task is done or passed testing" />
        </Card>
      )}

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer list-none text-[12px] text-sub underline decoration-dotted">
            Done and passed testing ({done.length})
          </summary>
          <Card className="mt-3">
            <div className="divide-y divide-line">
              {done.map((t: any) => (
                <ClickupRow key={t.id} t={t} />
              ))}
            </div>
          </Card>
        </details>
      )}

      {unmatched.length > 0 && (
        <Card>
          <CardHeader
            title="Unmatched tasks"
            sub="No property could be inferred from the name, list or tags"
          />
          <div className="divide-y divide-line">
            {unmatched.slice(0, 25).map((t: any) => (
              <ClickupRow key={t.id} t={t} />
            ))}
          </div>
        </Card>
      )}

      {exceptions.length > 0 && (
        <Card>
          <CardHeader title="Sync exceptions" />
          <ul className="divide-y divide-line">
            {exceptions.slice(0, 20).map((e: any) => (
              <li key={e.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <Pill tone="bad">{e.source}</Pill>
                  {e.reason}
                </div>
                <div className="text-[11px] text-faint">
                  {e.job_name} · {ago(e.seen_at)}
                  {e.external_id ? ` · ${e.external_id}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!tasks.length && (
        <Card>
          <Empty>Nothing has synced from ClickUp yet.</Empty>
        </Card>
      )}
    </main>
  );
}
