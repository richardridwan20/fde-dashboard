// Generates the FDE hub weekly status, matching the format posted in Slack.
//
// Data-driven sections (SHIPPED THIS WEEK, IN PROGRESS) are derived from
// blockers and ClickUp tasks. OVERALL, WAITING ON CLIENT, RISKS and NEXT WEEK
// are written by hand and stored in fde.weekly_reports, because no amount of
// status data tells you what a decision needs.

export function mondayOf(d: Date = new Date()) {
  const x = new Date(d);
  const dayFromMonday = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dayFromMonday);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * `?week=` comes off the URL, so it can be anything. `new Date('nonsense')`
 * is an Invalid Date that survives mondayOf() — every arithmetic op on it is a
 * silent NaN — and only throws several lines later inside isoDate():
 * "RangeError: Invalid time value". Fall back to the current week instead.
 */
export function weekStartFrom(value?: string | null) {
  if (!value) return mondayOf();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? mondayOf() : mondayOf(parsed);
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function ordinal(n: number) {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return suffix[(v - 20) % 10] || suffix[v] || suffix[0];
}

/** "03rd August 2026" */
export function weekLabel(d: Date) {
  const day = d.getDate();
  const month = d.toLocaleString('en-GB', { month: 'long' });
  return `${String(day).padStart(2, '0')}${ordinal(day)} ${month} ${d.getFullYear()}`;
}

/** "13/8" */
function dm(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const person = (name?: string | null) => (name ? `@${name}` : '@unassigned');
const link = (title: string, url?: string | null) => (url ? `[${title}](${url})` : title);

function byWorkstream(rows: any[]) {
  const out: Record<string, any[]> = {};
  rows.forEach((r) => {
    const key = r.workstream_label || 'Other';
    (out[key] = out[key] || []).push(r);
  });
  return out;
}

/** Sections always render, with "* -" when empty, matching the posted format. */
function section(title: string, body: string) {
  return `${title}\n\n${body.trim() ? body.trimEnd() : '* -'}\n`;
}

export type ReportInput = {
  property: { name: string };
  weekStart: Date;
  author?: string;
  narrative?: {
    overall_md?: string | null;
    waiting_md?: string | null;
    risks_md?: string | null;
    next_week_md?: string | null;
  };
  blockers: any[];
  tasks: any[];
  meetings: any[];
};

export function buildReport({
  property,
  weekStart,
  author = 'Richard',
  narrative = {},
  blockers,
  tasks,
  meetings
}: ReportInput) {
  const since = new Date(weekStart);

  const shippedBlockers = blockers.filter(
    (b) => b.state === 'resolved' && b.resolved_at && new Date(b.resolved_at) >= since
  );
  const shippedTasks = tasks.filter(
    (t) =>
      ['done', 'passed_testing'].includes(t.state) &&
      t.updated_at_source &&
      new Date(t.updated_at_source) >= since
  );
  const inProgress = blockers.filter((b) =>
    ['open', 'in_progress', 'blocked_on_eng'].includes(b.state)
  );
  const waiting = blockers.filter((b) => b.state === 'blocked_on_client');
  const risky = blockers.filter(
    (b) => b.state !== 'resolved' && ['critical', 'high'].includes(b.severity) && b.is_overdue
  );
  const upcoming = meetings.filter(
    (m) => m.state === 'scheduled' && new Date(m.starts_at) >= new Date()
  );

  const out: string[] = [];
  out.push(`${property.name} — Weekly Status | Week of ${weekLabel(weekStart)}`);
  out.push(`From: @${author}`);
  out.push('');

  out.push(section('OVERALL', narrative.overall_md || ''));

  let shipped = '';
  shippedTasks.forEach((t) => {
    shipped += `* ${person(t.assignee)} - ${link(t.name, t.url)}\n`;
  });
  shippedBlockers.forEach((b) => {
    shipped += `* ${person(b.owner_name)} - ${link(b.title, b.external_url)}\n`;
  });
  out.push(section('SHIPPED THIS WEEK', shipped));

  // Sub-bullet under a workstream heading only when there is more than one,
  // which is how the real reports read.
  let progress = '';
  const grouped = byWorkstream(inProgress);
  const streams = Object.keys(grouped).sort();
  if (streams.length > 1) {
    streams.forEach((s) => {
      progress += `* ${s}:\n`;
      grouped[s].forEach((b) => {
        progress += `   * ${person(b.owner_name)} - ${link(b.title, b.external_url)}${
          b.eta ? ` - ETA ${dm(b.eta)}` : ''
        }\n`;
      });
    });
  } else {
    inProgress.forEach((b) => {
      progress += `* ${person(b.owner_name)} - ${link(b.title, b.external_url)}${
        b.eta ? ` - ETA ${dm(b.eta)}` : ''
      }\n`;
    });
  }
  out.push(section('IN PROGRESS', progress));

  let waitingBody = narrative.waiting_md ? narrative.waiting_md.trimEnd() + '\n' : '';
  waiting.forEach((b) => {
    waitingBody += `* ${b.title}${b.next_action ? ` — ${b.next_action}` : ''}\n`;
  });
  out.push(section('WAITING ON CLIENT', waitingBody));

  let risks = narrative.risks_md ? narrative.risks_md.trimEnd() + '\n' : '';
  risky.forEach((b) => {
    risks += `* ${b.title} is ${b.severity} and past ETA${b.eta ? ` (${dm(b.eta)})` : ''}${
      b.next_action ? ` — ${b.next_action}` : ''
    }\n`;
  });
  out.push(section('RISKS / DECISIONS NEEDED', risks));

  let next = narrative.next_week_md ? narrative.next_week_md.trimEnd() + '\n' : '';
  upcoming.forEach((m) => {
    const d = new Date(m.starts_at);
    next += `* ${m.title} — ${d.getDate()}/${d.getMonth() + 1}${m.meet_url ? ` (${m.meet_url})` : ''}\n`;
  });
  out.push(section('NEXT WEEK', next));

  out.push('Thanks!');
  return out.join('\n');
}
