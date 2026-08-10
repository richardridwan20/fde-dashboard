'use client';

import { saveMeetingNotes } from '@/lib/actions';
import { MarkdownEditor } from '@/components/markdown-editor';

export function MeetingNotes({ meeting, photos }: { meeting: any; photos: any[] }) {
  return (
    <MarkdownEditor
      value={meeting.notes_md}
      photos={photos}
      label={`Notes — ${meeting.title}`}
      onSave={(md) => saveMeetingNotes(meeting.id, md)}
      placeholder={
        meeting.agenda
          ? `## Agenda\n${meeting.agenda}\n\n## Notes\n`
          : '## What we covered\n\n## Decisions\n\n## Follow-ups\n'
      }
    />
  );
}
