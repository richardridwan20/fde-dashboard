'use client';

import { ExternalLink, Pencil } from 'lucide-react';
import { patchBlocker } from '@/lib/actions';
import { BLOCKER_STATES } from '@/lib/enums';
import { Button, Pill } from '@/components/ui';
import { enumOptions, severityTone } from '@/lib/ui-helpers';
import { QuickSelect } from '@/components/quick-edit';
import { BlockerDialog } from '@/components/forms/blocker-dialog';
import { fmtDate } from '@/components/shared';

/**
 * One blocker.
 *
 * State stays inline — it is the field that changes most often and it is a
 * closed set, so a dropdown is the whole interaction. Everything else moved
 * behind Edit: severity, ETA and workstream were four controls competing for
 * the same row, and next_action was a single-line input that truncated
 * anything worth reading. It now renders as wrapped text and is edited in the
 * dialog, where it has room.
 */
export function BlockerCard({
  b,
  drift,
  workstreams,
  devices
}: {
  b: any;
  drift?: any[];
  workstreams?: { key: string; label: string }[];
  devices?: any[];
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium">{b.title}</span>
            {b.external_url && (
              <a
                href={b.external_url}
                target="_blank"
                rel="noreferrer"
                className="text-faint hover:text-ink"
                title="Open in ClickUp"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
            <Pill tone={severityTone(b.severity)}>{b.severity}</Pill>
            {b.workstream_label && <Pill>{b.workstream_label}</Pill>}
            {b.integration_label && <Pill>{b.integration_label}</Pill>}
            <span>{b.age_days}d old</span>
            {b.eta && (
              <span className={b.is_overdue ? 'text-destructive' : undefined}>
                · ETA {fmtDate(b.eta)}
                {b.is_overdue ? ' · past ETA' : ''}
              </span>
            )}
            {b.waiting_days !== null && b.waiting_days !== undefined && (
              <span>· {b.waiting_days === 0 ? 'waiting since today' : `${b.waiting_days}d waiting`}</span>
            )}
            {b.owner_name && <span>· @{b.owner_name}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <QuickSelect
            value={b.state}
            options={enumOptions(BLOCKER_STATES)}
            onSave={(v) => patchBlocker(b.id, { state: v })}
          />
          <BlockerDialog
            propertyId={b.property_id}
            blocker={b}
            devices={devices}
            workstreams={workstreams}
            trigger={
              <Button size="xs" variant="outline">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            }
          />
        </div>
      </div>

      {/* Full text, wrapped. The old inline input cut this off mid-sentence. */}
      {b.next_action && (
        <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[12px] text-sub">
          <span className="text-faint">Next: </span>
          {b.next_action}
        </p>
      )}

      {b.detail && (
        <p className="mt-1.5 max-w-3xl whitespace-pre-wrap text-[12px] text-faint">{b.detail}</p>
      )}

      {b.state === 'resolved' && b.resolution_note && (
        <p className="mt-1.5 max-w-3xl whitespace-pre-wrap rounded-md bg-soft px-2.5 py-1.5 text-[12px] text-sub">
          <span className="text-faint">Resolved: </span>
          {b.resolution_note}
        </p>
      )}

      {drift && drift.length > 0 && (
        <div className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          {drift.map((d) => (
            <div key={d.task_id}>
              ClickUp says “{d.status_raw}” —{' '}
              <a href={d.task_url} target="_blank" rel="noreferrer" className="underline">
                {d.task_name}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
