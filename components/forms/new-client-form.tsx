'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientRecord } from '@/lib/actions';
import { newClientSchema, type NewClientValues } from '@/lib/schemas';
import { STAGES } from '@/lib/enums';
import { Button, Card, Field, FieldControl, FieldLabel, Input, Select, toast } from '@/components/ui';

export function NewClientForm({ groups = [] }: { groups?: any[] }) {
  const router = useRouter();

  const {
    control, register, handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<NewClientValues>({
    resolver: zodResolver(newClientSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '', group_id: '', stage: 'not_started', onboarding_date: '',
      contact_person: '', pic_hotel_staff: '', postal_code: '', prefecture: '',
      city: '', region: '', address: '', address_ja: '', website_url: ''
    }
  });

  // The action seeds the onboarding checklist for the new property, so we land
  // on its page rather than the list.
  const onSubmit = async (values: NewClientValues) => {
    const r = await createClientRecord(values);
    if (!r.ok) return toast.error('Nothing was created', { description: r.message });
    toast.success(r.message);
    router.push(r.slug ? `/property/${r.slug}` : '/');
    router.refresh();
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
    <Card className="p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <F name="name" label="Client name" placeholder="Piece Hostel Kyoto" />

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field error={errors.group_id}>
            <FieldLabel hint="optional">Group</FieldLabel>
            <Controller
              control={control}
              name="group_id"
              render={({ field }) => (
                <FieldControl>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    placeholder="Independent"
                    options={groups.map((g) => ({ value: g.id, label: g.name }))}
                  />
                </FieldControl>
              )}
            />
          </Field>

          <Field error={errors.stage}>
            <FieldLabel>Stage</FieldLabel>
            <Controller
              control={control}
              name="stage"
              render={({ field }) => (
                <FieldControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={STAGES.map((s) => ({ value: s.key, label: s.label }))}
                  />
                </FieldControl>
              )}
            />
          </Field>

          <F name="onboarding_date" label="Target onboarding date" type="date" hint="optional" />
          <F name="contact_person" label="Contact person" hint="optional" />
          <F name="pic_hotel_staff" label="Hotel PIC" hint="optional" />
          <F name="postal_code" label="Postal code" placeholder="604-8074" />
          <F name="city" label="City" hint="optional" />
          <F name="prefecture" label="Prefecture" hint="optional" />
        </div>

        <F name="address" label="Address" hint="feeds the map" />
        <F name="website_url" label="Website" placeholder="https://…" hint="optional" />

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create client
          </Button>
        </div>
      </form>
    </Card>
  );
}
