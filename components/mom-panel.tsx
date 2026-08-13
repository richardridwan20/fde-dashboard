'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Card, CardHeader, toast } from '@/components/ui';
import { buildBlocks, renderHtml, renderMrkdwn, type Person } from '@/lib/mom';

const WORKSPACE = 'washimo.slack.com';

/** The headings the generator reads, spelled out where you can act on them. */
function Contract() {
  return (
    <ul className="ml-4 list-disc space-y-1 text-[12px] text-sub">
      <li>
        <code className="text-[11px]">## Topics (@Name)</code> — becomes “@Name shares topic
        for …” with the bullets nested under it. The name is optional.
      </li>
      <li>
        <code className="text-[11px]">## Feedbacks</code> — reproduced word for word in a code
        block, so arrows and <code className="text-[11px]">**bold**</code> survive intact.
      </li>
      <li>
        <code className="text-[11px]">## Action Items</code> — a leading name resolves to a
        mention: <code className="text-[11px]">@Nursandy</code>,{' '}
        <code className="text-[11px]">Nursandy</code> or{' '}
        <code className="text-[11px]">Ikegami-san</code> all work.
      </li>
      <li>
        <code className="text-[11px]">## Photos</code> — dropped, since images cannot survive a
        paste. Any other heading is carried through.
      </li>
    </ul>
  );
}

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
    kind: meeting.kind,
    notesMd: meeting.notes_md || '',
    attendees: meeting.attendees || [],
    ccKeys,
    people
  };

  const { text, html, empty, unlinked } = React.useMemo(() => {
    const r = buildBlocks(input);
    return {
      text: renderMrkdwn(r.blocks, WORKSPACE),
      html: renderHtml(r.blocks, WORKSPACE),
      empty: r.empty,
      unlinked: r.unlinked
    };
  }, [meeting, people, ccKeys]);

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

  // Gate on whether anything was actually assembled, not on whether notes
  // exist — notes that are all photos, or all prose under an unread heading,
  // would otherwise render a card claiming to have assembled nothing.
  if (empty) {
    return (
      <Card>
        <CardHeader
          title="Minutes draft"
          sub={meeting.notes_md?.trim() ? 'Nothing to assemble from these notes yet' : undefined}
        />
        <div className="space-y-2 px-4 py-4">
          <p className="text-[13px] text-sub">
            {meeting.notes_md?.trim()
              ? 'The notes have no section this reads. Use these headings and it assembles the post:'
              : 'Write the notes first. These headings become the Slack post:'}
          </p>
          <Contract />
        </div>
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
              {copied === 'rich' ? 'Copied' : 'Copy with mentions'}
            </Button>
            <Button size="xs" variant="outline" onClick={() => copy('plain')}>
              {copied === 'plain' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'plain' ? 'Copied' : 'Copy plain text'}
            </Button>
          </div>
        }
      />
      <div className="p-4">
        {unlinked.length > 0 && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            No Slack ID on file, so {unlinked.length === 1 ? 'this name pastes' : 'these names paste'}{' '}
            as plain text rather than a mention:{' '}
            <span className="font-medium">{unlinked.join(', ')}</span>. Fill in{' '}
            <code className="text-[11px]">fde.slack_people.slack_user_id</code> and every future
            meeting picks it up.
          </div>
        )}
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-card p-4 font-mono text-[12px] leading-relaxed">
          {text}
        </pre>
        <p className="mt-2 text-[11px] text-faint">
          Add <code className="text-[10px]">(@Name)</code> to a{' '}
          <code className="text-[10px]">## Topics</code> heading to attribute it. Trimming
          already-done action items is yours — the notes do not record which landed before the
          meeting.
        </p>
      </div>
    </Card>
  );
}
