import Link from 'next/link';
import { getRecentChanges, getAudit } from '@/lib/data';
import { Card, CardHeader, Empty, Pill } from '@/components/ui';
import { ago, fmtDateTime } from '@/components/shared';

export const dynamic = 'force-dynamic';

/** One feed of everything that moved, so the Monday question "what changed?"
 *  has an answer that is not a Slack scroll. */
export default async function Changes() {
  const [changes, audit] = await Promise.all([getRecentChanges(), getAudit()]);

  const byDay: Record<string, any[]> = {};
  changes.forEach((c: any) => {
    const day = new Date(c.occurred_at).toDateString();
    (byDay[day] = byDay[day] || []).push(c);
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">Changes</h1>
        <p className="text-[12px] text-faint">Everything recorded across every property, newest first.</p>
      </div>

      {Object.entries(byDay).map(([day, items]) => (
        <Card key={day}>
          <CardHeader
            title={new Date(day).toLocaleDateString('en-GB', {
              weekday: 'long', day: '2-digit', month: 'long'
            })}
            sub={`${items.length} event${items.length > 1 ? 's' : ''}`}
          />
          <ul className="divide-y divide-line">
            {items.map((c: any) => (
              <li key={c.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{c.kind.replace(/_/g, ' ')}</Pill>
                  <span className="text-[13px]">{c.summary}</span>
                </div>
                <div className="text-[11px] text-faint">
                  {c.property_slug ? (
                    <Link href={`/property/${c.property_slug}`} className="underline">
                      {c.property_name}
                    </Link>
                  ) : (
                    'portfolio'
                  )}{' '}
                  · {ago(c.occurred_at)} · {c.source}
                  {c.actor_name ? ` · ${c.actor_name}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {!changes.length && (
        <Card>
          <Empty>Nothing has changed yet.</Empty>
        </Card>
      )}

      {audit.length > 0 && (
        <details>
          <summary className="cursor-pointer list-none text-[12px] text-sub underline decoration-dotted">
            Raw audit trail ({audit.length})
          </summary>
          <Card className="mt-3">
            <ul className="divide-y divide-line text-[12px]">
              {audit.map((a: any) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span>
                    {a.action} on <code className="text-[11px]">{a.table_name}</code>
                  </span>
                  <span className="text-[11px] text-faint">
                    {a.changed_by || 'system'} · {fmtDateTime(a.changed_at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </details>
      )}
    </main>
  );
}
