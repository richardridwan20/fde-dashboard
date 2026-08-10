'use client';

// Leads are prospects, not work in flight — they'd otherwise pad out every
// group table on the portfolio. Rendered as its own <tbody> (legal HTML, and
// it lets the server keep rendering the <tr> children) that starts collapsed.

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { plural } from '@/lib/ui-helpers';
import { cn } from '@/lib/utils';

export function LeadFold({
  count,
  colSpan,
  children
}: {
  count: number;
  colSpan: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  if (!count) return null;

  return (
    <tbody className="divide-y divide-line border-t border-line">
      <tr>
        <td colSpan={colSpan} className="p-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[11px] text-faint hover:bg-soft hover:text-sub"
          >
            <ChevronRight
              className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')}
              aria-hidden
            />
            {open ? 'Hide' : 'Show'} {plural(count, 'lead')}
          </button>
        </td>
      </tr>
      {open && children}
    </tbody>
  );
}
