// Deliberately no 'use client'. The directive would make browserSupabase a
// client reference, and calling a client function from the server throws at
// request time. This module is only ever imported by client components, so it
// inherits their environment without needing the directive.

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/config';

export const browserSupabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
