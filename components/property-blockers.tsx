'use client';

import { ExternalLink } from 'lucide-react';
import { patchBlocker } from '@/lib/actions';
import { BLOCKER_STATES, SEVERITIES } from '@/lib/enums';
import { Pill, enumOptions, severityTone } from '@/components/ui';
import { QuickDate, QuickSelect, QuickText } from '@/components/quick-edit';

/**
 * One blocker, editable in place. Severity, state and ETA write straight
 * through; the next action commits on blur.
 */
export function BlockerCard({
  b,
  drift,
  workstreams
}: {
  b: any;
  drift?: any[];
  workstreams?: { key: string; label: string }[];
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
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
            <span>{b.age_days}d old</span>
            {b.is_overdue && <span className="text-destructive">past ETA</span>}
            {b.owner_name && <span>· @{b.owner_name}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <QuickSelect
            value={b.state}
            options={enumOptions(BLOCKER_STATES)}
            onSave={(v) => patchBlocker(b.id, { state: v })}
          />
          <QuickSelect
            value={b.severity}
            options={enumOptions(SEVERITIES)}
            onSave={(v) => patchBlocker(b.id, { severity: v })}
            className="min-w-[6.5rem]"
          />
          <QuickDate value={b.eta} onSave={(v) => patchBlocker(b.id, { eta: v })} />
          {workstreams && (
            <QuickSelect
              value={b.workstream || undefined}
              placeholder="Workstream"
              options={workstreams.map((w) => ({ value: w.key, label: w.label }))}
              onSave={(v) => patchBlocker(b.id, { workstream: v })}
            />
          )}
        </div>
      </div>

      <div className="mt-2">
        <QuickText
          value={b.next_action}
          placeholder="Next action…"
          onSave={(v) => patchBlocker(b.id, { next_action: v })}
          className="w-full max-w-xl"
        />
      </div>

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
