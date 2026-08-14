import * as z from 'zod';

/** Optional free text: empty string is allowed and normalised to null on save. */
const optional = (max = 200) => z.string().trim().max(max).optional().or(z.literal(''));

export const clientDetailsSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  contact_person: optional(120),
  pic_hotel_staff: optional(200),
  postal_code: z
    .string()
    .trim()
    .regex(/^$|^\d{3}-?\d{4}$/, 'Use a Japanese postal code, e.g. 604-8074.')
    .optional()
    .or(z.literal('')),
  prefecture: optional(60),
  city: optional(60),
  region: optional(60),
  address: optional(300),
  address_ja: optional(300),
  website_url: z.string().trim().url('Enter a full URL starting with https://').optional().or(z.literal(''))
});
export type ClientDetailsValues = z.infer<typeof clientDetailsSchema>;

export const blockerSchema = z.object({
  property_id: z.string().uuid('Choose a client.'),
  title: z.string().trim().min(5, 'Say what is stuck in at least 5 characters.').max(160),
  next_action: optional(300),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  state: z.enum(['open', 'in_progress', 'blocked_on_client', 'blocked_on_eng', 'resolved']),
  workstream: z.string().optional().or(z.literal('')),
  eta: z.string().optional().or(z.literal('')),
  integration_key: z.string().optional().or(z.literal('')),
  external_url: z.string().trim().url('Enter a full ClickUp URL.').optional().or(z.literal(''))
});
export type BlockerValues = z.infer<typeof blockerSchema>;

export const newClientSchema = clientDetailsSchema.extend({
  group_id: z.string().optional().or(z.literal('')),
  stage: z.enum(['lead', 'not_started', 'requirement_gathering', 'account_setup', 'onboarded', 'done']),
  onboarding_date: z.string().optional().or(z.literal(''))
});
export type NewClientValues = z.infer<typeof newClientSchema>;

export const photoSchema = z.object({
  caption: optional(160),
  category: z.enum(['site', 'kiosk', 'device', 'network', 'signage', 'issue', 'document', 'other']),
  integration_key: z.string().optional().or(z.literal('')),
  meeting_id: z.string().optional().or(z.literal('')),
  taken_at: z.string().optional().or(z.literal(''))
});
export type PhotoValues = z.infer<typeof photoSchema>;

export const deviceSchema = z.object({
  integration_key: z.string().min(1, 'Choose a device.'),
  status: z.enum(['not_started', 'in_progress', 'blocked', 'degraded', 'live'])
});
export type DeviceValues = z.infer<typeof deviceSchema>;

export const meetingSchema = z.object({
  // Exactly one target, mirroring the meetings_target_ck constraint. A group
  // activity is inherited by every member property rather than copied to each.
  property_id: z.string().uuid().optional().or(z.literal('')),
  group_id: z.string().uuid().optional().or(z.literal('')),
  title: z.string().trim().min(3, 'Give the activity a title.').max(160),
  kind: z.enum([
    'kickoff', 'weekly', 'review', 'training', 'ad_hoc',
    'data_migration', 'setup', 'connectivity', 'site_visit', 'go_live'
  ]),
  state: z.enum(['scheduled', 'held', 'cancelled', 'no_show']),
  starts_at: z.string().min(1, 'Pick a date and time.'),
  duration_min: z.coerce.number().int().min(5, 'At least 5 minutes.').max(480),
  // Any conferencing link is fine; we do not create the room, only record it.
  meet_url: z.string().trim().url('Paste the full meeting URL.').optional().or(z.literal('')),
  location: optional(160),
  workstream: z.string().optional().or(z.literal('')),
  attendees: optional(300),
  agenda: z.string().trim().max(4000).optional().or(z.literal(''))
}).refine((v) => Boolean(v.property_id) !== Boolean(v.group_id), {
  message: 'Choose a client or a group, not both.',
  path: ['property_id']
});
export type MeetingValues = z.infer<typeof meetingSchema>;

export const weeklyNarrativeSchema = z.object({
  overall_md: z.string().max(8000).optional().or(z.literal('')),
  waiting_md: z.string().max(4000).optional().or(z.literal('')),
  risks_md: z.string().max(4000).optional().or(z.literal('')),
  next_week_md: z.string().max(4000).optional().or(z.literal(''))
});
export type WeeklyNarrativeValues = z.infer<typeof weeklyNarrativeSchema>;
