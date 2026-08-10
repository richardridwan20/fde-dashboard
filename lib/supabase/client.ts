'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/config';

export const browserSupabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
