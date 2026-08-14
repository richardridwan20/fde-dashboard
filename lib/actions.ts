'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase/server';
import { PHOTO_BUCKET, MAX_UPLOAD_BYTES } from '@/lib/config';

export type Result = { ok: boolean; message: string };

const nz = (v: any) => {
  const s = typeof v === 'string' ? v.trim() : v;
  return s === '' || s === undefined ? null : s;
};

function check(error: any, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

/**
 * Actions never throw to the UI. They return { ok, message } and the caller
 * raises a toast. An earlier version swallowed errors entirely and every write
 * silently no-opped — never do that again.
 */
async function run(fn: () => Promise<string>): Promise<Result> {
  try {
    const message = await fn();
    revalidatePath('/', 'layout');
    return { ok: true, message };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Something went wrong.' };
  }
}

// ---------------------------------------------------------------- properties

export async function saveClientDetails(id: string, values: Record<string, any>) {
  return run(async () => {
    const s = await getSupabase();
    const patch: any = { updated_at: new Date().toISOString() };
    for (const k of [
      'name', 'contact_person', 'pic_hotel_staff', 'postal_code', 'prefecture',
      'city', 'region', 'address', 'address_ja', 'website_url'
    ]) {
      if (k in values) patch[k] = nz(values[k]);
    }
    check((await s.from('properties').update(patch).eq('id', id)).error, 'Could not save client details');
    return 'Client details saved';
  });
}

export async function setStage(id: string, stage: string) {
  return run(async () => {
    const s = await getSupabase();
    check(
      (await s.from('properties').update({ stage, stage_since: new Date().toISOString() }).eq('id', id)).error,
      'Could not change the stage'
    );
    return `Stage set to ${stage.replace(/_/g, ' ')}`;
  });
}

export async function setOnboardingDate(id: string, date: string) {
  return run(async () => {
    const s = await getSupabase();
    check(
      (await s.from('properties').update({ onboarding_date: nz(date) }).eq('id', id)).error,
      'Could not set the onboarding date'
    );
    return date ? `Onboarding date set to ${date}` : 'Onboarding date cleared';
  });
}

/** Manual until the Hasura connector lands; readiness_source records who set it. */
export async function setReadiness(id: string, field: 'pms_readiness' | 'channel_manager' | 'payment_gateway', value: string) {
  return run(async () => {
    const s = await getSupabase();
    const patch: any = {
      readiness_source: 'manual',
      readiness_checked_at: new Date().toISOString()
    };
    patch[field] = value;
    check((await s.from('properties').update(patch).eq('id', id)).error, 'Could not update readiness');
    return `${field.replace(/_/g, ' ')} set to ${value.replace(/_/g, ' ')}`;
  });
}

export async function createClientRecord(values: Record<string, any>): Promise<Result & { slug?: string }> {
  try {
    const s = await getSupabase();
    const name = nz(values.name);
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { data, error } = await s
      .from('properties')
      .insert({
        name, slug, country: 'Japan',
        group_id: nz(values.group_id),
        stage: values.stage || 'not_started',
        city: nz(values.city), region: nz(values.region),
        prefecture: nz(values.prefecture), postal_code: nz(values.postal_code),
        address: nz(values.address), contact_person: nz(values.contact_person),
        pic_hotel_staff: nz(values.pic_hotel_staff),
        onboarding_date: nz(values.onboarding_date),
        website_url: nz(values.website_url)
      })
      .select('id, slug')
      .single();

    if (error) {
      throw new Error(
        error.message.includes('duplicate') ? 'A client with that name already exists.' : error.message
      );
    }

    const { data: items } = await s.from('v_checklist_items').select('key');
    if (data?.id && items?.length) {
      await s.from('property_checklist').insert(
        items.map((i: any) => ({ property_id: data.id, item_key: i.key, is_done: false }))
      );
    }

    revalidatePath('/', 'layout');
    return { ok: true, message: `${name} created`, slug: data?.slug };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Could not create the client.' };
  }
}

// ------------------------------------------------------------------ blockers

export async function saveBlocker(values: Record<string, any>, id?: string) {
  return run(async () => {
    const s = await getSupabase();
    const body: any = {
      property_id: values.property_id,
      title: nz(values.title),
      next_action: nz(values.next_action),
      severity: values.severity,
      state: values.state,
      eta: nz(values.eta),
      workstream: nz(values.workstream),
      integration_key: nz(values.integration_key),
      external_url: nz(values.external_url),
      raised_by: 'manual',
      tags: []
    };
    // resolved_at drives SHIPPED THIS WEEK in the report, so it has to be
    // cleared when a blocker is reopened, not just set when it is closed.
    body.resolved_at = values.state === 'resolved' ? new Date().toISOString() : null;

    if (id) {
      check((await s.from('blockers').update(body).eq('id', id)).error, 'Could not update the blocker');
      return 'Blocker updated';
    }
    check((await s.from('blockers').insert(body)).error, 'Could not raise the blocker');
    return 'Blocker raised';
  });
}

export async function patchBlocker(id: string, patch: Record<string, any>) {
  return run(async () => {
    const s = await getSupabase();
    const body: any = { ...patch };
    if ('eta' in body) body.eta = nz(body.eta);
    if ('next_action' in body) body.next_action = nz(body.next_action);
    if ('workstream' in body) body.workstream = nz(body.workstream);
    // Clear on reopen as well as set on resolve — a stale resolved_at keeps a
    // reopened blocker in the report's SHIPPED THIS WEEK section.
    if ('state' in body) {
      body.resolved_at = body.state === 'resolved' ? new Date().toISOString() : null;
    }

    check((await s.from('blockers').update(body).eq('id', id)).error, 'Could not update the blocker');

    const key = Object.keys(patch)[0];
    if (key === 'state') return `Moved to ${String(patch.state).replace(/_/g, ' ')}`;
    if (key === 'severity') return `Severity set to ${patch.severity}`;
    if (key === 'eta') return patch.eta ? `ETA set to ${patch.eta}` : 'ETA cleared';
    if (key === 'workstream') return 'Workstream updated';
    return 'Blocker updated';
  });
}

// ----------------------------------------------------------------- checklist

export async function toggleChecklistItem(propertyId: string, itemKey: string, isDone: boolean, label: string) {
  return run(async () => {
    const s = await getSupabase();
    check(
      (await s
        .from('property_checklist')
        .update({ is_done: isDone, updated_at: new Date().toISOString() })
        .eq('property_id', propertyId)
        .eq('item_key', itemKey)).error,
      'Could not update the checklist'
    );
    return isDone ? `Ticked “${label}”` : `Unticked “${label}”`;
  });
}

export async function setChecklistNote(propertyId: string, itemKey: string, value: string) {
  return run(async () => {
    const s = await getSupabase();
    check(
      (await s
        .from('property_checklist')
        .update({ value: nz(value), updated_at: new Date().toISOString() })
        .eq('property_id', propertyId)
        .eq('item_key', itemKey)).error,
      'Could not save the note'
    );
    return 'Note saved';
  });
}

// ------------------------------------------------------------------- devices

export async function setDeviceStatus(id: string, status: string) {
  return run(async () => {
    const s = await getSupabase();
    check(
      (await s.from('property_integrations')
        .update({ status, status_since: new Date().toISOString() })
        .eq('id', id)).error,
      'Could not update the device'
    );
    return `Device set to ${status.replace(/_/g, ' ')}`;
  });
}

export async function addDevice(propertyId: string, values: Record<string, any>) {
  return run(async () => {
    const s = await getSupabase();
    check(
      (await s.from('property_integrations').insert({
        property_id: propertyId,
        integration_key: values.integration_key,
        status: values.status || 'not_started',
        source: 'manual'
      })).error,
      'Could not add the device'
    );
    return 'Device added';
  });
}

export async function removeDevice(id: string) {
  return run(async () => {
    const s = await getSupabase();
    check((await s.from('property_integrations').delete().eq('id', id)).error, 'Could not remove the device');
    return 'Device removed';
  });
}

// -------------------------------------------------------------------- photos

export async function uploadPhotos(fd: FormData) {
  return run(async () => {
    const s = await getSupabase();
    // A photo belongs to a property or to a group, never both — same XOR the
    // activity uses, since a group session's photos are slides, not site shots.
    const propertyId = nz(fd.get('property_id'));
    const groupId = nz(fd.get('group_id'));
    if (!propertyId && !groupId) throw new Error('No property or group to attach these to');
    const files = fd
      .getAll('files')
      .filter((f: any) => f && typeof f === 'object' && 'size' in f && f.size > 0) as File[];

    if (!files.length) throw new Error('No file selected');

    // The browser compresses first; this is the backstop before Vercel rejects it.
    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > MAX_UPLOAD_BYTES) {
      throw new Error(`${(total / 1048576).toFixed(1)} MB is over the 4 MB limit`);
    }

    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${propertyId || `group-${groupId}`}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      check(
        (await s.storage.from(PHOTO_BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), {
          contentType: file.type || 'image/jpeg'
        })).error,
        `Could not upload ${file.name}`
      );

      const { data: pub } = s.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      check(
        (await s.from('property_photos').insert({
          property_id: propertyId,
          group_id: groupId,
          storage_path: path,
          public_url: pub.publicUrl,
          caption: nz(fd.get('caption')),
          category: fd.get('category') || 'other',
          integration_key: nz(fd.get('integration_key')),
          meeting_id: nz(fd.get('meeting_id')),
          taken_at: nz(fd.get('taken_at')),
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: 'dashboard'
        })).error,
        `Could not record ${file.name}`
      );
    }

    return files.length > 1 ? `${files.length} photos uploaded` : 'Photo uploaded';
  });
}

export async function updatePhoto(id: string, patch: Record<string, any>) {
  return run(async () => {
    const s = await getSupabase();
    const body: any = {};
    for (const k of ['caption', 'category', 'integration_key', 'meeting_id', 'taken_at']) {
      if (k in patch) body[k] = nz(patch[k]);
    }
    check((await s.from('property_photos').update(body).eq('id', id)).error, 'Could not update the photo');
    return 'caption' in patch ? 'Caption saved' : 'Photo updated';
  });
}

/** Bulk-safe: also removes the objects from storage so the bucket does not leak. */
export async function deletePhotos(items: { id: string; storage_path: string }[]) {
  return run(async () => {
    const s = await getSupabase();
    if (!items.length) throw new Error('Nothing selected');
    await s.storage.from(PHOTO_BUCKET).remove(items.map((i) => i.storage_path));
    check(
      (await s.from('property_photos').delete().in('id', items.map((i) => i.id))).error,
      'Could not delete the photos'
    );
    return items.length > 1 ? `${items.length} photos deleted` : 'Photo deleted';
  });
}

// ------------------------------------------------------------------ meetings

export async function saveMeeting(values: Record<string, any>, id?: string) {
  return run(async () => {
    const s = await getSupabase();
    const body: any = {
      title: nz(values.title),
      kind: values.kind,
      state: values.state,
      starts_at: new Date(values.starts_at).toISOString(),
      duration_min: Number(values.duration_min) || 30,
      meet_url: nz(values.meet_url),
      location: nz(values.location),
      workstream: nz(values.workstream),
      agenda: nz(values.agenda),
      attendees: String(values.attendees || '')
        .split(',')
        .map((x: string) => x.trim())
        .filter(Boolean),
      updated_at: new Date().toISOString()
    };

    // The target belongs in BOTH branches. Leaving it out of the update made
    // the dialog's Client/Group toggle a no-op that still reported success.
    const target = {
      property_id: values.property_id || null,
      group_id: values.group_id || null
    };

    if (id) {
      check(
        (await s.from('meetings').update({ ...body, ...target }).eq('id', id)).error,
        'Could not update the activity'
      );
      return 'Activity updated';
    }
    check(
      (await s.from('meetings').insert({ ...body, ...target })).error,
      'Could not save the activity'
    );
    return 'Activity saved';
  });
}

export async function saveMeetingNotes(id: string, notesMd: string) {
  return run(async () => {
    const s = await getSupabase();
    check(
      (await s.from('meetings')
        .update({ notes_md: nz(notesMd), updated_at: new Date().toISOString() })
        .eq('id', id)).error,
      'Could not save the notes'
    );
    return 'Notes saved';
  });
}

export async function setMeetingState(id: string, state: string) {
  return run(async () => {
    const s = await getSupabase();
    check(
      (await s.from('meetings').update({ state, updated_at: new Date().toISOString() }).eq('id', id)).error,
      'Could not update the activity'
    );
    return `Marked ${state.replace(/_/g, ' ')}`;
  });
}

export async function deleteMeeting(id: string) {
  return run(async () => {
    const s = await getSupabase();
    check((await s.from('meetings').delete().eq('id', id)).error, 'Could not delete the meeting');
    return 'Activity deleted';
  });
}

// --------------------------------------------------------------- ramp-up

/**
 * First-week homework. Not a task tracker — just enough to see the ramp.
 *
 * Argument order is (id, title, state) so a server component can pre-bind the
 * first two — `setRampTaskState.bind(null, t.id, t.title)` — and hand the
 * result to a client component. Passing an inline arrow instead throws
 * "Event handlers cannot be passed to Client Component props".
 */
export async function setRampTaskState(id: string, title: string, state: string) {
  return run(async () => {
    const s = await getSupabase();
    const patch: any = { state };
    patch.completed_at = state === 'done' ? new Date().toISOString() : null;
    check((await s.from('ramp_tasks').update(patch).eq('id', id)).error, 'Could not update the task');
    return `“${title}” → ${state.replace(/_/g, ' ')}`;
  });
}

// ------------------------------------------------------------ weekly reports

/** Only the hand-written halves are stored; the rest is derived at render. */
export async function saveWeeklyNarrative(
  propertyId: string,
  weekStart: string,
  values: Record<string, any>
) {
  return run(async () => {
    const s = await getSupabase();
    check(
      (await s.from('weekly_reports').upsert(
        {
          property_id: propertyId,
          week_start: weekStart,
          overall_md: nz(values.overall_md),
          waiting_md: nz(values.waiting_md),
          risks_md: nz(values.risks_md),
          next_week_md: nz(values.next_week_md),
          author: 'Richard',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'property_id,week_start' }
      )).error,
      'Could not save the report'
    );
    return 'Report saved';
  });
}
