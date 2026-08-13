import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Toaster } from '@/components/ui';
import { getUser } from '@/lib/supabase/server';
import { AUTH_ENABLED } from '@/lib/config';

export const metadata: Metadata = {
  title: 'FDE Dashboard — Wasimil',
  description: 'Onboarding and integration health across every property.'
};

const NAV = [
  ['/', 'Overview'],
  ['/blockers', 'Blockers'],
  ['/checkin', 'Check-in'],
  ['/devices', 'Devices'],
  ['/meetings', 'Activities'],
  ['/reports', 'Reports'],
  ['/photos', 'Photos'],
  ['/clickup', 'ClickUp'],
  ['/changes', 'Changes'],
  ['/team', 'Team']
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Link href="/" className="text-[13px] font-medium">
              Wasimil <span className="text-faint">FDE</span>
            </Link>
            {/* Wraps rather than overflowing — ten links do not fit a phone. */}
            <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-sub">
              {NAV.slice(1).map(([href, label]) => (
                <Link key={href} href={href} className="hover:text-ink hover:underline">
                  {label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-[11px] text-faint">
              {AUTH_ENABLED && user && (
                <>
                  <span>{user.email}</span>
                  <a href="/auth/signout" className="underline">
                    sign out
                  </a>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
