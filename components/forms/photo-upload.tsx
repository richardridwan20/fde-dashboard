'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { uploadPhotos } from '@/lib/actions';
import { PHOTO_CATEGORIES } from '@/lib/enums';
import { IMG_MAX_DIM, IMG_QUALITY, MAX_UPLOAD_BYTES } from '@/lib/config';
import {
  Button, Dialog, Field, FieldControl, FieldLabel, Input, Select, enumOptions, toast
} from '@/components/ui';

/**
 * Site photos come off phones at 4–8 MB each and Vercel rejects a request body
 * over ~4.5 MB before app code runs, so we downscale in the browser first.
 * The server action still checks the total as a backstop.
 */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, IMG_MAX_DIM / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, 'image/jpeg', IMG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function PhotoUpload({
  propertyId,
  devices = [],
  meetings = [],
  meetingId,
  label = 'Add photos'
}: {
  propertyId: string;
  devices?: any[];
  meetings?: any[];
  meetingId?: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [caption, setCaption] = React.useState('');
  const [category, setCategory] = React.useState('site');
  const [integration, setIntegration] = React.useState('');
  const [meeting, setMeeting] = React.useState(meetingId || '');
  const [takenAt, setTakenAt] = React.useState('');

  const total = files.reduce((n, f) => n + f.size, 0);
  const overLimit = total > MAX_UPLOAD_BYTES;

  async function pick(list: FileList | null) {
    if (!list?.length) return setFiles([]);
    setBusy(true);
    setFiles(await Promise.all(Array.from(list).map(compress)));
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return toast.error('Choose at least one photo');
    setBusy(true);
    const fd = new FormData();
    fd.set('property_id', propertyId);
    fd.set('caption', caption);
    fd.set('category', category);
    fd.set('integration_key', integration);
    fd.set('meeting_id', meeting);
    fd.set('taken_at', takenAt);
    files.forEach((f) => fd.append('files', f));

    const r = await uploadPhotos(fd);
    setBusy(false);
    if (!r.ok) return toast.error('Nothing was uploaded', { description: r.message });
    toast.success(r.message);
    setFiles([]);
    setCaption('');
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Upload photos"
      description="Images are downscaled in the browser before they are sent."
      trigger={
        <Button size="sm" variant="outline">
          <Upload className="h-3.5 w-3.5" /> {label}
        </Button>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field error={overLimit ? `${(total / 1048576).toFixed(1)} MB is over the 4 MB limit.` : null}>
          <FieldLabel hint={files.length ? `${files.length} selected · ${(total / 1048576).toFixed(1)} MB` : undefined}>
            Photos
          </FieldLabel>
          <FieldControl>
            <Input
              type="file"
              accept="image/*"
              multiple
              className="h-auto py-1.5 file:mr-2 file:rounded file:border-0 file:bg-soft file:px-2 file:py-1 file:text-[12px]"
              onChange={(e) => pick(e.target.files)}
            />
          </FieldControl>
        </Field>

        <Field>
          <FieldLabel hint="optional">Caption</FieldLabel>
          <FieldControl>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Kiosk in the lobby" />
          </FieldControl>
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field>
            <FieldLabel>Category</FieldLabel>
            <FieldControl>
              <Select value={category} onValueChange={setCategory} options={enumOptions(PHOTO_CATEGORIES)} />
            </FieldControl>
          </Field>

          <Field>
            <FieldLabel hint="optional">Taken on</FieldLabel>
            <FieldControl>
              <Input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
            </FieldControl>
          </Field>

          {devices.length > 0 && (
            <Field>
              <FieldLabel hint="optional">Device</FieldLabel>
              <FieldControl>
                <Select
                  value={integration || undefined}
                  onValueChange={setIntegration}
                  placeholder="None"
                  options={devices.map((d) => ({ value: d.integration_key || d.key, label: d.integration_label || d.label }))}
                />
              </FieldControl>
            </Field>
          )}

          {meetings.length > 0 && !meetingId && (
            <Field>
              <FieldLabel hint="embeds them in the notes">Meeting</FieldLabel>
              <FieldControl>
                <Select
                  value={meeting || undefined}
                  onValueChange={setMeeting}
                  placeholder="None"
                  options={meetings.map((m) => ({ value: m.id, label: m.title }))}
                />
              </FieldControl>
            </Field>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={overLimit || !files.length}>
            Upload
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
