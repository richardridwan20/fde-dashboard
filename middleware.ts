import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_KEY, AUTH_ENABLED } from '@/lib/config';

const PUBLIC = ['/login', '/auth'];

/**
 * Refreshes the Supabase session cookie on every request. The gate itself is
 * off unless NEXT_PUBLIC_AUTH_ENABLED=true, so the URL stays shareable by
 * default — but while auth IS on, the refresh has to run on every request or a
 * signed-in session expires mid-use.
 *
 * While auth is off there is no session to refresh, and getUser() is a network
 * call to Supabase in ap-southeast-1 from whichever edge region the user hits.
 * The matcher covers nearly every request, so leaving it in cost a cross-region
 * round trip on each one — and unlike the page queries, pinning functions to
 * sin1 does not move it, because middleware runs at the edge. Short-circuit.
 */
export async function middleware(request: NextRequest) {
  if (!AUTH_ENABLED) return NextResponse.next({ request });

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

  if (!data.user) {
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
