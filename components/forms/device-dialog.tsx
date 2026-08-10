'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { addDevice } from '@/lib/actions';
import { deviceSchema, type DeviceValues } from '@/lib/schemas';
import { DEVICE_STATUSES } from '@/lib/enums';
import { Button, Dialog, Field, FieldControl, FieldLabel, Select, toast } from '@/components/ui';
import { enumOptions } from '@/lib/ui-helpers';

export function DeviceDialog({ propertyId, types = [] }: { propertyId: string; types?: any[] }) {
  const [open, setOpen] = React.useState(false);

  const {
    control, handleSubmit, reset,
    formState: { errors, isSubmitting }
  } = useForm<DeviceValues>({
    resolver: zodResolver(deviceSchema),
    mode: 'onBlur',
    defaultValues: { integration_key: '', status: 'not_started' }
  });

  const onSubmit = async (values: DeviceValues) => {
    const r = await addDevice(propertyId, values);
    if (!r.ok) return toast.error('Nothing was saved', { description: r.message });
    toast.success(r.message);
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Add a device"
      description="Devices track the integration status per property."
      trigger={
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5" /> Device
        </Button>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <Field error={errors.integration_key}>
          <FieldLabel>Device</FieldLabel>
          <Controller
            control={control}
            name="integration_key"
            render={({ field }) => (
              <FieldControl>
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  placeholder="Choose a device"
                  options={types.map((t) => ({ value: t.key, label: t.label }))}
                />
              </FieldControl>
            )}
          />
        </Field>

        <Field error={errors.status}>
          <FieldLabel>Status</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <FieldControl>
                <Select value={field.value} onValueChange={field.onChange} options={enumOptions(DEVICE_STATUSES)} />
              </FieldControl>
            )}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Add device
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
