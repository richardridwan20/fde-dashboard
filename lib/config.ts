export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pmmyqxdmjyxzsknvfpbr.supabase.co';
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_qUiVleGmbSe-RIyDPtsF6Q_E2cK2veB';

export const ALLOWED_DOMAIN = 'wasimil.com';

/** Auth gate. Off unless explicitly enabled, so the URL is public by default. */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';

export const PHOTO_BUCKET = 'property-photos';

/** Vercel rejects function request bodies above ~4.5 MB before app code runs. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const IMG_MAX_DIM = 1920;
export const IMG_QUALITY = 0.82;
