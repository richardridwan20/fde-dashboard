import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_KEY, AUTH_ENABLED } from '@/lib/config';

export async function getSupabase() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Throws in Server Components; safe to ignore because middleware refreshes.
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {}
      }
    }
  });
}

export async function getUser() {
  if (!AUTH_ENABLED) return null;
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
