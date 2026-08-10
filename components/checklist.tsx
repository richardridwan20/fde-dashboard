'use client';

import * as React from 'react';
import { setChecklistNote, toggleChecklistItem } from '@/lib/actions';
import { Empty } from '@/components/ui';
import { QuickText, QuickTick } from '@/components/quick-edit';

/**
 * The onboarding checklist, grouped by category. Ticks and notes write through
 * the same quick-edit controls as everything else, so a tick behaves like a
 * status change: spinner, toast, no silent failure.
 */
export function Checklist({ propertyId, items }: { propertyId: string; items: any[] }) {
  const groups = React.useMemo(() => {
    const out: Record<string, any[]> = {};
    items.forEach((i) => (out[i.category || 'Other'] = out[i.category || 'Other'] || []).push(i));
    return out;
  }, [items]);

  if (!items.length) return <Empty>No checklist items for this client yet.</Empty>;

  return (
    <div className="divide-y divide-line">
      {Object.entries(groups).map(([category, rows]) => (
        <div key={category} className="px-4 py-3">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
            {category.replace(/_/g, ' ')}
            <span className="ml-2 normal-case tracking-normal">
              {rows.filter((r) => r.is_done).length}/{rows.length}
            </span>
          </div>
          <ul className="space-y-2">
            {rows.map((i) => (
              <li key={i.item_key} className="flex flex-wrap items-center justify-between gap-2">
                <QuickTick
                  checked={!!i.is_done}
                  label={i.label}
                  onSave={(v) => toggleChecklistItem(propertyId, i.item_key, v, i.label)}
                />
                <QuickText
                  value={i.value}
                  placeholder="note…"
                  onSave={(v) => setChecklistNote(propertyId, i.item_key, v)}
                  className="w-full sm:w-56"
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
