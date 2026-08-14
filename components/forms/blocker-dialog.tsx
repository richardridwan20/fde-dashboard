'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { saveBlocker } from '@/lib/actions';
import { blockerSchema, type BlockerValues } from '@/lib/schemas';
import { BLOCKER_STATES, SEVERITIES } from '@/lib/enums';
import { Button, Dialog, Field, FieldControl, FieldLabel, Input, Select, Textarea, toast } from '@/components/ui';
import { enumOptions } from '@/lib/ui-helpers';

export function BlockerDialog({
  propertyId,
  blocker,
  clients = [],
  devices = [],
  workstreams = [],
  trigger
}: {
  propertyId: string | null;
  /** Present = edit an existing blocker rather than raise a new one. */
  blocker?: any;
  clients?: any[];
  devices?: any[];
  workstreams?: { key: string; label: string }[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  const {
    control, register, handleSubmit, reset,
    formState: { errors, isSubmitting }
  } = useForm<BlockerValues>({
    resolver: zodResolver(blockerSchema),
    mode: 'onBlur',
    defaultValues: {
      property_id: blocker?.property_id || propertyId || '',
      title: blocker?.title || '',
      next_action: blocker?.next_action || '',
      severity: blocker?.severity || 'medium',
      state: blocker?.state || 'open',
      workstream: blocker?.workstream || '',
      eta: blocker?.eta || '',
      integration_key: blocker?.integration_key || '',
      external_url: blocker?.external_url || ''
    }
  });

  const onSubmit = async (values: BlockerValues) => {
    const r = await saveBlocker(values, blocker?.id);
    if (!r.ok) return toast.error('Nothing was saved', { description: r.message });
    toast.success(r.message);
    // Keep the edited values on an edit; clear the entry fields on a raise so
    // the next one starts fresh.
    reset(blocker ? values : { ...values, title: '', next_action: '', eta: '', external_url: '' });
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      wide
      title={blocker ? 'Edit blocker' : 'Raise a blocker'}
      description="What is stuck, who is on it, and when it is due."
      trigger={
        trigger ?? (
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> Blocker
          </Button>
        )
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {!propertyId && !blocker && (
          <Field error={errors.property_id}>
            <FieldLabel>Client</FieldLabel>
            <Controller
              control={control}
              name="property_id"
              render={({ field }) => (
                <FieldControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Choose a client"
                    options={clients.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </FieldControl>
              )}
            />
          </Field>
        )}

        <Field error={errors.title}>
          <FieldLabel>What is blocked</FieldLabel>
          <FieldControl>
            <Input {...register('title')} placeholder="Kiosk cannot reach the PMS bridge" />
          </FieldControl>
        </Field>

        <Field error={errors.next_action}>
          <FieldLabel hint="optional">Next action</FieldLabel>
          <FieldControl>
            <Textarea {...register('next_action')} rows={2} placeholder="Reza to re-pair the bridge on site" />
          </FieldControl>
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field error={errors.severity}>
            <FieldLabel>Severity</FieldLabel>
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <FieldControl>
                  <Select value={field.value} onValueChange={field.onChange} options={enumOptions(SEVERITIES)} />
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
                  <Select value={field.value} onValueChange={field.onChange} options={enumOptions(BLOCKER_STATES)} />
                </FieldControl>
              )}
            />
          </Field>

          <Field error={errors.eta}>
            <FieldLabel hint="optional">ETA</FieldLabel>
            <FieldControl>
              <Input type="date" {...register('eta')} />
            </FieldControl>
          </Field>

          <Field error={errors.workstream}>
            <FieldLabel hint="groups the weekly report">Workstream</FieldLabel>
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

          {devices.length > 0 && (
            <Field error={errors.integration_key}>
              <FieldLabel hint="optional">Device</FieldLabel>
              <Controller
                control={control}
                name="integration_key"
                render={({ field }) => (
                  <FieldControl>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      placeholder="None"
                      options={devices.map((d) => ({ value: d.key, label: d.label }))}
                    />
                  </FieldControl>
                )}
              />
            </Field>
          )}

          <Field error={errors.external_url}>
            <FieldLabel hint="optional">ClickUp URL</FieldLabel>
            <FieldControl>
              <Input {...register('external_url')} placeholder="https://app.clickup.com/t/…" />
            </FieldControl>
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {blocker ? 'Save blocker' : 'Raise blocker'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
