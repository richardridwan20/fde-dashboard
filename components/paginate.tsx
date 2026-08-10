'use client';

// Client-side paging over rows the server already rendered. Passing ReactNodes
// (rather than raw data) keeps date formatting on the server, so relative
// timestamps like ago() can't drift between render and hydration.

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Empty } from '@/components/ui';

export function Paginated({
  items,
  pageSize = 10,
  empty = 'Nothing recorded yet.',
  noun = 'items'
}: {
  items: React.ReactNode[];
  pageSize?: number;
  empty?: React.ReactNode;
  noun?: string;
}) {
  const [page, setPage] = React.useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  // Guard against the list shrinking under us on a revalidate.
  const current = Math.min(page, pages - 1);
  const start = current * pageSize;
  const slice = items.slice(start, start + pageSize);

  if (!items.length) return <Empty>{empty}</Empty>;

  return (
    <>
      <ul className="divide-y divide-line">{slice}</ul>
      {items.length > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2">
          <span className="text-[11px] text-faint">
            {start + 1}–{start + slice.length} of {items.length} {noun}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="outline"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </Button>
            <span className="px-1 text-[11px] text-faint">
              {current + 1} / {pages}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              Next <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
