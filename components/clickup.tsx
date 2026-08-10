import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { plural } from '@/lib/ui-helpers';

/**
 * Drift is a blocker whose linked ClickUp task disagrees with it — done in
 * ClickUp but still open here, or the reverse. Worth surfacing loudly because
 * it means the dashboard is lying to someone.
 */
export function DriftBanner({ drift }: { drift: any[] }) {
  if (!drift?.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-amber-900">
        <AlertTriangle className="h-4 w-4" />
        {plural(drift.length, 'blocker')} disagree{drift.length === 1 ? 's' : ''} with ClickUp
      </div>
      <ul className="mt-1.5 space-y-1 text-[12px] text-amber-800">
        {drift.slice(0, 6).map((d) => (
          <li key={`${d.blocker_id}-${d.task_id}`}>
            <Link href={`/property/${d.property_slug}`} className="underline">
              {d.property_name}
            </Link>{' '}
            — “{d.blocker_title}” is {d.blocker_state.replace(/_/g, ' ')} here, “{d.status_raw}” in{' '}
            <a href={d.task_url} target="_blank" rel="noreferrer" className="underline">
              ClickUp
            </a>
          </li>
        ))}
        {drift.length > 6 && (
          <li>
            <Link href="/clickup" className="underline">
              and {drift.length - 6} more
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
