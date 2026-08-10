// "What am I chasing, and for how long?" — the question the weekly report kept
// needing and the dashboard could not answer.
//
// age_days measures how old the PROBLEM is. waiting_days measures how long it
// has sat with the client since it last changed state, which is the number that
// tells you a chase has gone unanswered. They are usually different.

import Link from 'next/link';
import { Card, CardHeader, Empty, Pill } from '@/components/ui';
import { plural } from '@/lib/ui-helpers';
import { fmtDate } from '@/components/shared';

/** Escalating tone: a fortnight of silence is a different problem to two days. */
function waitTone(days: number) {
  if (days >= 14) return 'bad';
  if (days >= 7) return 'warn';
  return 'info';
}

export function WaitingOnClient({ items }: { items: any[] }) {
  return (
    <section className="mb-8">
      <Card>
        <CardHeader
          title="Waiting on client"
          sub="Longest silence first"
          right={<span className="text-[11px] text-faint">{items.length}</span>}
        />
        {items.length === 0 ? (
          <Empty>Nothing is sitting with a client right now.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {items.map((b: any) => {
              const days = b.waiting_days ?? 0;
              return (
                <div
                  key={b.id}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13px]">{b.title}</div>
                    <div className="text-[11px] text-faint">
                      <Link href={`/property/${b.property_slug}`} className="hover:underline">
                        {b.property_name}
                      </Link>
                      {b.next_action ? ` · ${b.next_action}` : ''}
                      {b.eta ? ` · ETA ${fmtDate(b.eta)}` : ''}
                    </div>
                  </div>
                  <Pill tone={waitTone(days)}>
                    {days === 0 ? 'since today' : `${plural(days, 'day')} waiting`}
                  </Pill>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
