'use client';

import * as React from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { deletePhotos, updatePhoto } from '@/lib/actions';
import { Button, Checkbox, Empty, Pill, toast } from '@/components/ui';
import { QuickText } from '@/components/quick-edit';
import { cn } from '@/lib/utils';

/**
 * Photo grid with inline caption editing and multi-select delete. Delete also
 * removes the object from storage, so selecting twenty and deleting them does
 * not leave twenty orphans in the bucket.
 */
export function PhotoGrid({
  photos,
  showProperty = false
}: {
  photos: any[];
  showProperty?: boolean;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function removeSelected() {
    setBusy(true);
    const items = photos
      .filter((p) => selected.has(p.id))
      .map((p) => ({ id: p.id, storage_path: p.storage_path }));
    const r = await deletePhotos(items);
    setBusy(false);
    if (!r.ok) return toast.error('Nothing was deleted', { description: r.message });
    toast.success(r.message);
    setSelected(new Set());
  }

  if (!photos.length) return <Empty>No photos yet.</Empty>;

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] text-faint">
          {selected.size ? `${selected.size} selected` : `${photos.length} photo${photos.length > 1 ? 's' : ''}`}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button size="xs" variant="destructive" loading={busy} onClick={removeSelected}>
                <Trash2 className="h-3.5 w-3.5" /> Delete {selected.size}
              </Button>
            </>
          )}
          {selected.size === 0 && photos.length > 1 && (
            <Button size="xs" variant="ghost" onClick={() => setSelected(new Set(photos.map((p) => p.id)))}>
              Select all
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => {
          const on = selected.has(p.id);
          return (
            <figure
              key={p.id}
              className={cn(
                'overflow-hidden rounded-lg border bg-card transition-shadow',
                on ? 'border-primary ring-2 ring-ring' : 'border-line'
              )}
            >
              <div className="relative">
                <a href={p.public_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.public_url}
                    alt={p.caption || 'Site photo'}
                    loading="lazy"
                    className="h-36 w-full object-cover"
                  />
                </a>
                <div className="absolute left-2 top-2 rounded bg-white/90 p-1">
                  <Checkbox checked={on} onCheckedChange={() => toggle(p.id)} />
                </div>
              </div>
              <figcaption className="space-y-1.5 p-2">
                <QuickText
                  value={p.caption}
                  placeholder="caption…"
                  onSave={(v) => updatePhoto(p.id, { caption: v })}
                  className="w-full"
                />
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-faint">
                  <Pill>{p.category}</Pill>
                  {p.integration_label && <Pill>{p.integration_label}</Pill>}
                  {p.meeting_title && <Pill tone="info">{p.meeting_title}</Pill>}
                  {showProperty && p.property_slug && (
                    <Link href={`/property/${p.property_slug}`} className="underline">
                      {p.property_name}
                    </Link>
                  )}
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
