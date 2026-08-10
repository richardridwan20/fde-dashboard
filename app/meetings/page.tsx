import Link from 'next/link';
import { ExternalLink, Video } from 'lucide-react';
import {
  getAllMeetings, getOverview, getWorkstreams, getMeetingPhotos
} from '@/lib/data';
import { MEETING_STATES } from '@/lib/enums';
import { deleteMeeting, setMeetingState } from '@/lib/actions';
import { Button, Card, CardHeader, Empty, Pill } from '@/components/ui';
import { enumOptions, stateTone } from '@/lib/ui-helpers';
import { ConfirmButton, QuickSelect } from '@/components/quick-edit';
import { Metric, fmtDateTime } from '@/components/shared';
import { MeetingNotes } from '@/components/meeting-notes';
import { MeetingDialog } from '@/components/forms/meeting-dialog';
import { PhotoUpload } from '@/components/forms/photo-upload';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function Meetings({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const [meetings, clients, workstreams] = await Promise.all([
    getAllMeetings(), getOverview(), getWorkstreams()
  ]);

  const selected = meetings.find((m: any) => m.id === sp?.id) || meetings[0];
  const photos = selected ? await getMeetingPhotos(selected.id) : [];

  const now = Date.now();
  const upcoming = meetings.filter(
    (m: any) => m.state === 'scheduled' && new Date(m.starts_at).getTime() >= now
  );
  const past = meetings.filter((m: any) => !upcoming.includes(m));
  const missingNotes = past.filter((m: any) => m.state === 'held' && !m.has_notes);

  const Row = ({ m }: { m: any }) => (
    <Link
      href={`/meetings?id=${m.id}`}
      className={cn(
        'block px-4 py-2.5 hover:bg-soft',
        selected?.id === m.id && 'bg-soft'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px]">{m.title}</div>
          <div className="text-[11px] text-faint">
            {m.property_name} · {fmtDateTime(m.starts_at)} · {m.duration_min}m
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pill tone={stateTone(m.state)}>{m.state.replace(/_/g, ' ')}</Pill>
          {m.has_notes && <span className="text-[10px] text-faint">notes</span>}
        </div>
      </div>
    </Link>
  );

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium">Meetings</h1>
          <p className="text-[12px] text-faint">
            Schedule, then write the notes in markdown with the photos embedded.
          </p>
        </div>
        <MeetingDialog clients={clients} workstreams={workstreams} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Upcoming" value={upcoming.length} />
        <Metric label="Held" value={meetings.filter((m: any) => m.state === 'held').length} />
        <Metric
          label="Held without notes"
          value={missingNotes.length}
          tone={missingNotes.length ? 'bad' : undefined}
        />
        <Metric label="Total" value={meetings.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Upcoming" sub={`${upcoming.length}`} />
            <div className="divide-y divide-line">
              {upcoming.map((m: any) => (
                <Row key={m.id} m={m} />
              ))}
              {!upcoming.length && <Empty>Nothing scheduled.</Empty>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Past" sub={`${past.length}`} />
            <div className="max-h-[28rem] divide-y divide-line overflow-y-auto">
              {past.map((m: any) => (
                <Row key={m.id} m={m} />
              ))}
              {!past.length && <Empty>No meetings held yet.</Empty>}
            </div>
          </Card>
        </div>

        {selected ? (
          <Card>
            <CardHeader
              title={selected.title}
              sub={
                <span>
                  <Link href={`/property/${selected.property_slug}`} className="underline">
                    {selected.property_name}
                  </Link>{' '}
                  · {fmtDateTime(selected.starts_at)} · {selected.duration_min}m
                  {selected.workstream_label ? ` · ${selected.workstream_label}` : ''}
                </span>
              }
              right={
                <div className="flex flex-wrap items-center gap-2">
                  {selected.meet_url && (
                    <Button size="xs" variant="outline" asChild>
                      <a href={selected.meet_url} target="_blank" rel="noreferrer">
                        <Video className="h-3.5 w-3.5" /> Join
                      </a>
                    </Button>
                  )}
                  <QuickSelect
                    value={selected.state}
                    options={enumOptions(MEETING_STATES)}
                    onSave={(v) => setMeetingState(selected.id, v)}
                  />
                  <MeetingDialog
                    meeting={selected}
                    workstreams={workstreams}
                    trigger={
                      <Button size="xs" variant="outline">
                        Edit
                      </Button>
                    }
                  />
                  <ConfirmButton onConfirm={() => deleteMeeting(selected.id)} confirmLabel="Confirm delete" />
                </div>
              }
            />

            <div className="space-y-4 p-4">
              {(selected.attendees?.length > 0 || selected.location) && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                  {(selected.attendees || []).map((a: string) => (
                    <Pill key={a}>{a}</Pill>
                  ))}
                  {selected.location && <span>· {selected.location}</span>}
                  {selected.meet_url && (
                    <a
                      href={selected.meet_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline"
                    >
                      link <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              {selected.agenda && (
                <div className="rounded-md bg-soft px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-faint">Agenda</div>
                  <p className="whitespace-pre-wrap text-[13px]">{selected.agenda}</p>
                </div>
              )}

              <MeetingNotes meeting={selected} photos={photos} />

              <div className="flex items-center justify-between border-t border-line pt-3">
                <span className="text-[11px] text-faint">
                  {photos.length} photo{photos.length === 1 ? '' : 's'} attached to this meeting
                </span>
                <PhotoUpload
                  propertyId={selected.property_id}
                  meetingId={selected.id}
                  label="Attach photos"
                />
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <Empty>Schedule a meeting to start keeping notes.</Empty>
          </Card>
        )}
      </div>
    </main>
  );
}
