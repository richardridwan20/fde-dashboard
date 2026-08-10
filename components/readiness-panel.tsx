'use client';

import { setReadiness } from '@/lib/actions';
import { READINESS } from '@/lib/enums';
import { enumOptions } from '@/components/ui';
import { QuickSelect } from '@/components/quick-edit';
import { ago } from '@/components/shared';

const FIELDS = [
  { key: 'pms_readiness', label: 'PMS' },
  { key: 'channel_manager', label: 'Channel manager' },
  { key: 'payment_gateway', label: 'Payment gateway' }
] as const;

/**
 * Readiness is set by hand today. `readiness_source` records that, so when the
 * Hasura connector lands it can overwrite these without anyone wondering
 * whether a value came from a person or a sync.
 */
export function ReadinessPanel({ property }: { property: any }) {
  return (
    <div>
      <div className="divide-y divide-line">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <span className="text-[13px] text-sub">{f.label}</span>
            <QuickSelect
              value={property[f.key] || 'unknown'}
              options={enumOptions(READINESS)}
              onSave={(v) => setReadiness(property.id ?? property.property_id, f.key as any, v)}
            />
          </div>
        ))}
      </div>
      <div className="border-t border-line px-4 py-2 text-[11px] text-faint">
        {property.readiness_source === 'hasura' ? 'Synced from Hasura' : 'Set manually'}
        {property.readiness_checked_at ? ` · ${ago(property.readiness_checked_at)}` : ''}
      </div>
    </div>
  );
}
