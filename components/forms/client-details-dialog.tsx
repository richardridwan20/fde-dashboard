'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { saveClientDetails } from '@/lib/actions';
import { clientDetailsSchema, type ClientDetailsValues } from '@/lib/schemas';
import { Button, Dialog, Field, FieldControl, FieldLabel, Input, toast } from '@/components/ui';

/**
 * Client details are read-only at the top of a property page; this modal is the
 * only way to change them. The old design had a long form at the bottom of the
 * page that nobody scrolled to.
 */
export function ClientDetailsDialog({ property }: { property: any }) {
  const [open, setOpen] = React.useState(false);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting }
  } = useForm<ClientDetailsValues>({
    resolver: zodResolver(clientDetailsSchema),
    mode: 'onBlur',
    defaultValues: {
      name: property.name || '',
      contact_person: property.contact_person || '',
      pic_hotel_staff: property.pic_hotel_staff || '',
      postal_code: property.postal_code || '',
      prefecture: property.prefecture || '',
      city: property.city || '',
      region: property.region || '',
      address: property.address || '',
      address_ja: property.address_ja || '',
      website_url: property.website_url || ''
    }
  });

  const onSubmit = async (values: ClientDetailsValues) => {
    const r = await saveClientDetails(property.id, values);
    if (!r.ok) return toast.error('Nothing was saved', { description: r.message });
    toast.success(r.message);
    reset(values);
    setOpen(false);
  };

  const F = ({ name, label, hint, placeholder, type }: any) => (
    <Field error={(errors as any)[name]}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <FieldControl>
        <Input type={type} placeholder={placeholder} {...register(name)} />
      </FieldControl>
    </Field>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      wide
      title="Edit client details"
      description="Address feeds the map below."
      trigger={
        <Button size="sm" variant="outline">
          <Pencil className="h-3.5 w-3.5" /> Edit details
        </Button>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <F name="name" label="Client name" />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <F name="contact_person" label="Contact person" hint="optional" />
          <F name="pic_hotel_staff" label="Hotel PIC" hint="optional" />
          <F name="postal_code" label="Postal code" placeholder="604-8074" />
          <F name="prefecture" label="Prefecture" hint="optional" />
          <F name="city" label="City" hint="optional" />
          <F name="region" label="Region" hint="optional" />
        </div>
        <F name="address" label="Address" />
        <F name="address_ja" label="Address (Japanese)" hint="optional" />
        <F name="website_url" label="Website" placeholder="https://…" hint="optional" />

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save details
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
