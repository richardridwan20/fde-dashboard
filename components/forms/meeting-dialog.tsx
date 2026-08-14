'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarPlus, ExternalLink, Video } from 'lucide-react';
import { saveMeeting } from '@/lib/actions';
import { meetingSchema, type MeetingValues } from '@/lib/schemas';
import { MEETING_KINDS } from '@/lib/enums';
import { Button, Dialog, Field, FieldControl, FieldLabel, Input, Select, Textarea, toast } from '@/components/ui';
import { activityStateOptions, enumOptions } from '@/lib/ui-helpers';
import { cn } from '@/lib/utils';

/** ISO → the `YYYY-MM-DDTHH:mm` that datetime-local expects, in local time. */
function toLocalInput(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingDialog({
  meeting,
  propertyId,
  clients = [],
  groups = [],
  workstreams = [],
  trigger
}: {
  meeting?: any;
  propertyId?: string;
  clients?: any[];
  groups?: { id: string; name: string }[];
  workstreams?: { key: string; label: string }[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  const [target, setTarget] = React.useState<'property' | 'group'>(
    meeting?.group_id ? 'group' : 'property'
  );
  const isGroup = target === 'group';

  const {
    control, register, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting }
  } = useForm<MeetingValues>({
    resolver: zodResolver(meetingSchema),
    mode: 'onBlur',
    defaultValues: {
      property_id: meeting?.property_id || propertyId || '',
      group_id: meeting?.group_id || '',
      title: meeting?.title || '',
      kind: meeting?.kind || 'weekly',
      state: meeting?.state || 'scheduled',
      starts_at: toLocalInput(meeting?.starts_at),
      duration_min: meeting?.duration_min || 30,
      meet_url: meeting?.meet_url || '',
      location: meeting?.location || '',
      workstream: meeting?.workstream || '',
      attendees: (meeting?.attendees || []).join(', '),
      agenda: meeting?.agenda || ''
    }
  });

  const onSubmit = async (values: MeetingValues) => {
    const r = await saveMeeting(values, meeting?.id);
    if (!r.ok) return toast.error('Nothing was saved', { description: r.message });
    toast.success(r.message);
    setOpen(false);
  };

  const meetUrl = watch('meet_url');

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      wide
      title={meeting ? 'Edit activity' : 'Add an activity'}
      description="A meeting, a migration, an install or a site visit. Notes and photos attach to it either way."
      trigger={
        trigger ?? (
          <Button size="sm">
            <CalendarPlus className="h-3.5 w-3.5" /> Activity
          </Button>
        )
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {!propertyId && (
          <Field error={errors.property_id}>
            <FieldLabel hint={isGroup ? 'every property in the group' : 'one property'}>
              {isGroup ? 'Group' : 'Client'}
            </FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {/* One target, so switching clears the other side rather than
                  leaving a stale value the XOR constraint would reject. */}
              <div className="flex overflow-hidden rounded-md border border-line text-[12px]">
                {(['property', 'group'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setValue('property_id', '');
                      setValue('group_id', '');
                      setTarget(t);
                    }}
                    className={cn(
                      'px-2.5 py-1.5',
                      (t === 'group') === isGroup ? 'bg-primary text-primary-foreground' : 'hover:bg-soft'
                    )}
                  >
                    {t === 'property' ? 'Client' : 'Group'}
                  </button>
                ))}
              </div>
              <Controller
                control={control}
                name={isGroup ? 'group_id' : 'property_id'}
                render={({ field }) => (
                  <FieldControl>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      placeholder={isGroup ? 'Choose a group' : 'Choose a client'}
                      className="min-w-[14rem] flex-1"
                      options={
                        isGroup
                          ? groups.map((g) => ({ value: g.id, label: g.name }))
                          : clients.map((c) => ({ value: c.id, label: c.name }))
                      }
                    />
                  </FieldControl>
                )}
              />
            </div>
          </Field>
        )}

        <Field error={errors.title}>
          <FieldLabel>Title</FieldLabel>
          <FieldControl>
            <Input {...register('title')} placeholder="Weekly sync" />
          </FieldControl>
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field error={errors.starts_at}>
            <FieldLabel>Starts</FieldLabel>
            <FieldControl>
              <Input type="datetime-local" {...register('starts_at')} />
            </FieldControl>
          </Field>

          <Field error={errors.duration_min}>
            <FieldLabel hint="minutes">Duration</FieldLabel>
            <FieldControl>
              <Input type="number" min={5} max={480} step={5} {...register('duration_min')} />
            </FieldControl>
          </Field>

          <Field error={errors.kind}>
            <FieldLabel>Kind</FieldLabel>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <FieldControl>
                  <Select value={field.value} onValueChange={field.onChange} options={enumOptions(MEETING_KINDS)} />
                </FieldControl>
              )}
            />
          </Field>

          <Field error={errors.state}>
            <FieldLabel>State</FieldLabel>
            <Controller
              control={control}
              name="state"
              render={({ field }) => (
                <FieldControl>
                  <Select value={field.value} onValueChange={field.onChange} options={activityStateOptions(watch('kind'))} />
                </FieldControl>
              )}
            />
          </Field>

          <Field error={errors.workstream}>
            <FieldLabel hint="optional">Workstream</FieldLabel>
            <Controller
              control={control}
              name="workstream"
              render={({ field }) => (
                <FieldControl>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    placeholder="None"
                    options={workstreams.map((w) => ({ value: w.key, label: w.label }))}
                  />
                </FieldControl>
              )}
            />
          </Field>

          <Field error={errors.location}>
            <FieldLabel hint="optional">Location</FieldLabel>
            <FieldControl>
              <Input {...register('location')} placeholder="On site / Zoom / Meet" />
            </FieldControl>
          </Field>
        </div>

        {/* We do not hold Google Calendar credentials, so the room is created in
            Meet and the link pasted back. meet.new opens a fresh room in a tab. */}
        <Field error={errors.meet_url}>
          <FieldLabel hint="if there is one">Meeting URL</FieldLabel>
          <div className="flex gap-2">
            <FieldControl>
              <Input {...register('meet_url')} placeholder="https://meet.google.com/abc-defg-hij" />
            </FieldControl>
            <Button type="button" variant="outline" size="default" asChild>
              <a href="https://meet.new" target="_blank" rel="noreferrer" title="Create a Google Meet room">
                <Video className="h-3.5 w-3.5" /> New room
              </a>
            </Button>
          </div>
          {meetUrl && (
            <a
              href={meetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-sub underline"
            >
              <ExternalLink className="h-3 w-3" /> open link
            </a>
          )}
        </Field>

        <Field error={errors.attendees}>
          <FieldLabel hint="comma separated">Attendees</FieldLabel>
          <FieldControl>
            <Input {...register('attendees')} placeholder="Richard, Reza, Rido" />
          </FieldControl>
        </Field>

        <Field error={errors.agenda}>
          <FieldLabel hint="optional">Agenda</FieldLabel>
          <FieldControl>
            <Textarea rows={3} {...register('agenda')} placeholder="Check-in flow walkthrough, open blockers, go-live date" />
          </FieldControl>
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {meeting ? 'Save activity' : 'Add activity'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
