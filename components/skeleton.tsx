// Loading skeletons.
//
// App Router navigation blocks by default: with no loading.tsx, clicking a nav
// link renders nothing until the whole RSC payload lands, and because it is a
// client-side transition the browser shows no spinner either. The page simply
// sits there, which reads as lag rather than as work in progress.
//
// The second effect matters as much: for a force-dynamic route Next prefetches
// only as far as the first loading boundary, so without one there is nothing to
// prefetch and hovering a link does no useful work. These boundaries switch
// that back on.
//
// Shapes deliberately mirror the real page — same metric count, same column
// count — so the layout does not jump when the content arrives.

import { Card, CardHeader } from '@/components/ui';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-soft', className)} />;
}

function MetricsSkeleton({ count }: { count: number }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3',
        count >= 6 ? 'lg:grid-cols-6' : count === 4 ? 'sm:grid-cols-4' : 'lg:grid-cols-5'
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="px-4 py-3">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="mt-2 h-5 w-10" />
          <Skeleton className="mt-2 h-2 w-20" />
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <Card>
      <CardHeader title={<Skeleton className="h-3 w-32" />} />
      <div className="w-full overflow-hidden">
        <div className="divide-y divide-line">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 px-4 py-3">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={cn('h-3', c === 0 ? 'w-40 shrink-0' : 'w-16 shrink-0')}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <CardHeader title={<Skeleton className="h-3 w-28" />} />
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="mt-2 h-2 w-1/3" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * One composable skeleton rather than a bespoke file per route — the routes
 * differ only in how many metrics and how many cards they carry.
 *
 * The title is real text, not a bar: it is known at build time, so showing it
 * immediately means the heading never moves and you can tell which page you
 * landed on before the data arrives.
 */
export function PageSkeleton({
  title,
  sub,
  metrics = 0,
  tables = 0,
  cols = 7,
  lists = 1,
  rows = 5
}: {
  /** Omit on routes whose heading is data-driven, so it does not flash the
   *  wrong text — a property page heading is the property's name. */
  title?: string;
  sub?: string;
  metrics?: number;
  tables?: number;
  cols?: number;
  lists?: number;
  rows?: number;
}) {
  return (
    <main className="space-y-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading {title || 'page'}…</span>
      <div>
        {title ? (
          <h1 className="text-lg font-medium">{title}</h1>
        ) : (
          <Skeleton className="h-6 w-56" />
        )}
        {sub && <p className="text-[12px] text-faint">{sub}</p>}
      </div>

      {metrics > 0 && <MetricsSkeleton count={metrics} />}

      {Array.from({ length: tables }).map((_, i) => (
        <TableSkeleton key={`t${i}`} rows={rows} cols={cols} />
      ))}

      {Array.from({ length: lists }).map((_, i) => (
        <ListSkeleton key={`l${i}`} rows={rows} />
      ))}
    </main>
  );
}
