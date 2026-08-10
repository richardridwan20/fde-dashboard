// Presentational pieces shared across pages. No 'use client' — these render on
// the server; only the primitives they pull from components/ui are client code.

import Link from 'next/link';
import {
  Activity, AlertTriangle, Camera, CheckCircle2, CreditCard, Cpu, Globe,
  Monitor, Network, Printer, ScanLine, Server, Smartphone, Wifi
} from 'lucide-react';
import { Card, Pill, severityTone, stateTone } from '@/components/ui';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ dates */

export const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      })
    : '—';

export function ago(v?: string | null) {
  if (!v) return '—';
  const mins = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/* ---------------------------------------------------------------- metrics */

export function Metric({
  label,
  value,
  sub,
  tone,
  href
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: string;
  href?: string;
}) {
  const body = (
    <Card className={cn('px-4 py-3', href && 'transition-colors hover:bg-soft')}>
      <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
      <div className={cn('mt-0.5 text-xl font-medium', tone === 'bad' && 'text-destructive')}>{value}</div>
      {sub && <div className="text-[11px] text-sub">{sub}</div>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/* ------------------------------------------------------------- stage pill */

const STAGE_TONE: Record<string, string> = {
  lead: 'neutral',
  not_started: 'neutral',
  requirement_gathering: 'info',
  account_setup: 'info',
  onboarded: 'good',
  done: 'good'
};

export const StagePill = ({ stage }: { stage: string }) => (
  <Pill tone={STAGE_TONE[stage] || 'neutral'}>{stage.replace(/_/g, ' ')}</Pill>
);

export const StatePill = ({ state }: { state: string }) => (
  <Pill tone={stateTone(state)}>{state.replace(/_/g, ' ')}</Pill>
);

export const SeverityPill = ({ severity }: { severity: string }) => (
  <Pill tone={severityTone(severity)}>{severity}</Pill>
);

/* ------------------------------------------------------------ device icon */

// v_integration_types carries an `icon` key; map it to lucide rather than
// hand-drawing SVGs, which is what the first version did.
const ICONS: Record<string, any> = {
  kiosk: Monitor,
  printer: Printer,
  scanner: ScanLine,
  network: Network,
  wifi: Wifi,
  server: Server,
  payment: CreditCard,
  phone: Smartphone,
  cpu: Cpu,
  globe: Globe,
  activity: Activity
};

export function DeviceIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Ico = ICONS[icon || ''] || Cpu;
  return <Ico className={cn('h-4 w-4 text-sub', className)} aria-hidden />;
}

export function DeviceCard({
  d,
  children
}: {
  d: any;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <DeviceIcon icon={d.icon} />
        <div className="min-w-0">
          <div className="truncate text-[13px]">{d.integration_label || d.integration_key}</div>
          <div className="text-[11px] text-faint">
            {d.device_type || 'device'}
            {d.open_blockers > 0 && ` · ${d.open_blockers} open blocker${d.open_blockers > 1 ? 's' : ''}`}
            {d.last_bridge_report && ` · reported ${ago(d.last_bridge_report)}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">{children ?? <StatePill state={d.status} />}</div>
    </div>
  );
}

/* -------------------------------------------------------------- readiness */

export function ReadinessRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="text-[13px] text-sub">{label}</span>
      <StatePill state={value || 'unknown'} />
    </div>
  );
}

/* -------------------------------------------------------------- map embed */

// Keyless Google embeds: fine for an internal tool, no billing account needed.
const mapsQ = (p: any) =>
  encodeURIComponent([p.address, p.city, p.prefecture, p.postal_code, 'Japan'].filter(Boolean).join(', '));

export function MapEmbed({ property }: { property: any }) {
  if (!property.address && !property.city) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <iframe
        title="Map"
        loading="lazy"
        className="h-56 w-full rounded-lg border border-line"
        src={`https://www.google.com/maps?q=${mapsQ(property)}&output=embed`}
      />
      <iframe
        title="Street View"
        loading="lazy"
        className="h-56 w-full rounded-lg border border-line"
        src={`https://maps.google.com/maps?q=${mapsQ(property)}&layer=c&cbp=11,0,0,0,0&output=svembed`}
      />
    </div>
  );
}

/* ------------------------------------------------------------ clickup row */

export function ClickupRow({ t }: { t: any }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
      <div className="min-w-0">
        <a
          href={t.url}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] text-ink hover:underline"
        >
          {t.name}
        </a>
        <div className="text-[11px] text-faint">
          {t.property_name || 'unmatched'}
          {t.assignee ? ` · @${t.assignee}` : ''}
          {t.sprint ? ` · ${t.sprint}` : ''}
          {t.due_date ? ` · due ${fmtDate(t.due_date)}` : ''}
        </div>
      </div>
      <StatePill state={t.state} />
    </div>
  );
}

/* ------------------------------------------------------------- misc atoms */

export const Ok = () => <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
export const Warn = () => <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />;
export const PhotoIcon = () => <Camera className="h-3.5 w-3.5 text-faint" aria-hidden />;

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-soft">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-faint">
        {done}/{total}
      </span>
    </div>
  );
}
