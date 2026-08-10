'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Eye, ImagePlus, Pencil } from 'lucide-react';
import { Button, Textarea, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

type Result = { ok: boolean; message: string };

/** Read-only render, used wherever stored markdown is displayed. */
export function Markdown({ children, className }: { children?: string | null; className?: string }) {
  if (!children?.trim()) return <p className="text-[13px] text-faint">Nothing written yet.</p>;
  return (
    <div className={cn('prose prose-sm max-w-none prose-headings:font-medium prose-a:text-ink', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

/**
 * Split-pane editor. Side by side on desktop, tabbed on a phone — a 50/50 split
 * on a 390px screen gives two unusable columns.
 *
 * `photos` are the images attached to this meeting; clicking one inserts a
 * markdown image at the cursor rather than making the user copy a URL.
 */
export function MarkdownEditor({
  value,
  onSave,
  photos = [],
  placeholder = 'Write the notes in markdown…',
  rows = 16,
  label
}: {
  value?: string | null;
  onSave: (md: string) => Promise<Result>;
  photos?: { id: string; public_url: string; caption?: string | null }[];
  placeholder?: string;
  rows?: number;
  label?: string;
}) {
  const [draft, setDraft] = React.useState(value || '');
  const [saving, setSaving] = React.useState(false);
  const [tab, setTab] = React.useState<'write' | 'preview'>('write');
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => setDraft(value || ''), [value]);
  const dirty = (draft || '') !== (value || '');

  function insert(snippet: string) {
    const el = ref.current;
    const at = el ? el.selectionStart : draft.length;
    const next = draft.slice(0, at) + snippet + draft.slice(at);
    setDraft(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + snippet.length, at + snippet.length);
    });
  }

  async function save() {
    setSaving(true);
    const r = await onSave(draft);
    setSaving(false);
    if (r.ok) toast.success(r.message);
    else toast.error('Nothing was saved', { description: r.message });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:hidden">
          {(['write', 'preview'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              size="xs"
              variant={tab === t ? 'default' : 'ghost'}
              onClick={() => setTab(t)}
            >
              {t === 'write' ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {t}
            </Button>
          ))}
        </div>
        <div className="hidden text-[12px] font-medium text-sub sm:block">{label || 'Notes'}</div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[11px] text-faint">unsaved</span>}
          <Button type="button" size="sm" loading={saving} disabled={!dirty} onClick={save}>
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Textarea
          ref={ref}
          rows={rows}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          className={cn('font-mono text-[12px]', tab !== 'write' && 'hidden sm:block')}
        />
        <div
          className={cn(
            'min-h-[8rem] overflow-auto rounded-md border border-line bg-card px-3 py-2',
            tab !== 'preview' && 'hidden sm:block'
          )}
        >
          <Markdown>{draft}</Markdown>
        </div>
      </div>

      {photos.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-faint">
            <ImagePlus className="h-3.5 w-3.5" />
            Click a photo to embed it
          </div>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.caption || 'Insert'}
                onClick={() => insert(`\n![${p.caption || 'photo'}](${p.public_url})\n`)}
                className="h-14 w-14 overflow-hidden rounded border border-line hover:ring-2 hover:ring-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.public_url} alt={p.caption || ''} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
