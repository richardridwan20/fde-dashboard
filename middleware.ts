import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_KEY, AUTH_ENABLED } from '@/lib/config';

const PUBLIC = ['/login', '/auth'];

/**
 * Refreshes the Supabase session cookie on every request. The gate itself is
 * off unless NEXT_PUBLIC_AUTH_ENABLED=true, so the URL stays shareable by
 * default — but the refresh has to run either way, or a signed-in session
 * expires mid-use.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data } = await supabase.auth.getUser();

  if (AUTH_ENABLED && !data.user) {
    const path = request.nextUrl.pathname;
    if (!PUBLIC.some((p) => path.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
};
