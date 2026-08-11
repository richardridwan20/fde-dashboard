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
      // These headings are the contract the minutes generator parses. Topics
      // takes an optional "(@Name)" presenter, which is the one thing the notes
      // cannot otherwise record and the generator cannot guess.
      placeholder={
        '## Topics (@Name)\n- \n\n## Feedbacks\n- \n\n## Action Items\n- @Name will \n\n## Photos\n'
      }
    />
  );
}
