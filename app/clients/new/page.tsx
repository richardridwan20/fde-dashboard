import Link from 'next/link';
import { getGroups } from '@/lib/data';
import { NewClientForm } from '@/components/forms/new-client-form';

export const dynamic = 'force-dynamic';

export default async function NewClient() {
  const groups = await getGroups();

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <div>
        <div className="text-[11px] text-faint">
          <Link href="/" className="hover:underline">
            Portfolio
          </Link>
        </div>
        <h1 className="text-lg font-medium">New client</h1>
        <p className="text-[12px] text-faint">
          Creating a client seeds its onboarding checklist automatically.
        </p>
      </div>
      <NewClientForm groups={groups} />
    </main>
  );
}
