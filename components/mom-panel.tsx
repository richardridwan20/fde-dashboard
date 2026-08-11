'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Card, CardHeader, Empty, toast } from '@/components/ui';
import { buildMom, buildMomHtml, type Person } from '@/lib/mom';

/**
 * The minutes post, assembled from the notes. Copy only — no posting. You add
 * the attribution and trim the action items yourself, which is the part no
 * generator can do: the notes do not record who presented, or that an item was
 * already handled.
 *
 * Two clipboard flavours. Slack does not turn a pasted "<@U123>" into a
 * mention — that only happens for messages sent through the API — so the html
 * flavour carries real anchors to /team/<id>, which Slack keeps on paste and
 * renders as a person link. The plain flavour is the fallback for editors that
 * ignore text/html.
 */
export function MomPanel({
  meeting,
  people,
  ccKeys
}: {
  meeting: any;
  people: Person[];
  ccKeys: string[];
}) {
  const [copied, setCopied] = React.useState<'rich' | 'plain' | null>(null);

  const input = {
    title: meeting.title,
    notesMd: meeting.notes_md || '',
    attendees: meeting.attendees || [],
    ccKeys,
    people
  };

  const text = React.useMemo(() => buildMom(input), [meeting, people, ccKeys]);
  const html = React.useMemo(() => buildMomHtml(input), [meeting, people, ccKeys]);

  async function copy(flavour: 'rich' | 'plain') {
    try {
      if (flavour === 'rich' && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' })
          })
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(flavour);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error('Could not reach the clipboard', {
        description: 'Select the text below and copy it.'
      });
    }
  }

  if (!meeting.notes_md?.trim()) {
    return (
      <Card>
        <CardHeader title="Minutes draft" />
        <Empty>
          Write the notes first. Use <code className="text-[11px]">## Topics</code>,{' '}
          <code className="text-[11px]">## Feedbacks</code> and{' '}
          <code className="text-[11px]">## Action Items</code> headings and this assembles the
          Slack post from them.
        </Empty>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Minutes draft"
        sub="Assembled from your notes. Edit after pasting."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" onClick={() => copy('rich')}>
              {copied === 'rich' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'rich' ? 'Copied' : 'Copy for Slack'}
            </Button>
            <Button size="xs" variant="outline" onClick={() => copy('plain')}>
              {copied === 'plain' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'plain' ? 'Copied' : 'Copy raw'}
            </Button>
          </div>
        }
      />
      <div className="p-4">
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-card p-4 font-mono text-[12px] leading-relaxed">
          {text}
        </pre>
        <p className="mt-2 text-[11px] text-faint">
          Attribution and any already-done action items are yours to add and cut — the notes
          do not record who presented, or which items landed before the meeting.
        </p>
      </div>
    </Card>
  );
}
