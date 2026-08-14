// Drafts the four hand-written sections of the weekly report.
//
// This is the one place in the app where a model earns its place, and it is
// worth being precise about why — the minutes generator deliberately uses none.
// There, the bullets were already Richard's sentences and the job was assembly,
// so templating won and a paraphrase would have been a liability. Here the job
// is synthesis: read thirty structured facts and decide which three matter
// enough to lead with. There is no deterministic version of that, which is
// exactly why these four fields are hand-written today.
//
// Hard rules, enforced in the prompt and by what we send:
//  - Only facts we supply. No invention, no filling gaps with plausible detail.
//  - Never saved automatically. The draft lands in the form; a human saves.
//  - The derived sections (SHIPPED, IN PROGRESS) are NOT drafted — they come
//    from blockers and ClickUp and are already correct.

import { fmtDate } from '@/components/shared';

export type NarrativeFacts = {
  property: string;
  weekLabel: string;
  onboardingDate: string | null;
  daysToOnboarding: number | null;
  stage: string;
  gate: any;
  blockers: any[];
  tasks: any[];
  meetings: any[];
  checklist: any[];
  previous: any;
};

const bullet = (s: string) => `- ${s}`;

/** Everything the model is allowed to know, as plain text. */
export function factSheet(f: NarrativeFacts): string {
  const out: string[] = [];
  const open = f.blockers.filter((b) => b.state !== 'resolved');
  const resolved = f.blockers.filter((b) => b.state === 'resolved');
  const waiting = open.filter((b) => b.state === 'blocked_on_client');

  out.push(`PROPERTY: ${f.property}`);
  out.push(`WEEK: ${f.weekLabel}`);
  out.push(`STAGE: ${f.stage}`);
  out.push(
    `ONBOARDING DATE: ${f.onboardingDate ? fmtDate(f.onboardingDate) : 'not set'}` +
      (f.daysToOnboarding !== null
        ? f.daysToOnboarding < 0
          ? ` (${Math.abs(f.daysToOnboarding)} days past)`
          : ` (${f.daysToOnboarding} days away)`
        : '')
  );

  if (f.gate) {
    out.push('');
    out.push('GO-LIVE GATE:');
    out.push(bullet(`gating checklist ${f.gate.checklist_done}/${f.gate.checklist_total} — ${f.gate.checklist_ok ? 'passing' : 'FAILING'}`));
    out.push(bullet(`devices live ${f.gate.integrations_live}/${f.gate.integrations_total} — ${f.gate.integrations_ok ? 'passing' : 'FAILING'}`));
    out.push(bullet(`${f.gate.serious_blockers} critical/high blockers open — ${f.gate.blockers_ok ? 'passing' : 'FAILING'}`));
  }

  const missing = f.checklist.filter((c) => !c.is_done);
  if (missing.length) {
    out.push('');
    out.push('CHECKLIST NOT DONE:');
    missing.forEach((c) => out.push(bullet(`${c.category}: ${c.label}`)));
  }

  if (resolved.length) {
    out.push('');
    out.push('RESOLVED THIS WEEK (already listed under SHIPPED — do not repeat, but you may reference the theme):');
    resolved.forEach((b) =>
      out.push(bullet(`${b.title}${b.resolution_note ? ` — resolved: ${b.resolution_note}` : ''}`))
    );
  }

  if (open.length) {
    out.push('');
    out.push('OPEN BLOCKERS:');
    open.forEach((b) =>
      out.push(
        bullet(
          `[${b.severity}] ${b.title} (state: ${b.state.replace(/_/g, ' ')}, ${b.age_days}d old` +
            (b.waiting_days !== null && b.waiting_days !== undefined ? `, ${b.waiting_days}d waiting on client` : '') +
            (b.eta ? `, ETA ${fmtDate(b.eta)}${b.is_overdue ? ' — PAST ETA' : ''}` : ', no ETA') +
            `)` +
            (b.detail ? `\n  detail: ${b.detail}` : '') +
            (b.next_action ? `\n  next action: ${b.next_action}` : '')
        )
      )
    );
  }

  if (waiting.length) {
    out.push('');
    out.push(`NOTE: ${waiting.length} of the above are blocked on the client and are appended to WAITING ON CLIENT automatically. Do not restate them; add only what is NOT already a blocker.`);
  }

  const openTasks = f.tasks.filter((t) => !['done', 'passed_testing'].includes(t.state));
  if (openTasks.length) {
    out.push('');
    out.push('OPEN CLICKUP TASKS:');
    openTasks.slice(0, 15).forEach((t) =>
      out.push(bullet(`${t.title} (${t.state}${t.due_at ? `, due ${fmtDate(t.due_at)}` : ''}${t.assignee_name ? `, @${t.assignee_name}` : ''})`))
    );
  }

  if (f.meetings.length) {
    out.push('');
    out.push('ACTIVITIES (meetings, migrations, installs — scheduled ones append to NEXT WEEK automatically):');
    f.meetings.slice(0, 8).forEach((m) => {
      out.push(bullet(`${m.title} — ${m.kind.replace(/_/g, ' ')}, ${m.state}, ${fmtDate(m.starts_at)}`));
      if (m.notes_md) {
        out.push(`  notes: ${String(m.notes_md).replace(/\s+/g, ' ').slice(0, 1200)}`);
      }
    });
  }

  if (f.previous) {
    out.push('');
    out.push('LAST WEEK YOU WROTE (for continuity — say "still" or "now resolved" rather than repeating verbatim):');
    ['overall_md', 'waiting_md', 'risks_md', 'next_week_md'].forEach((k) => {
      if (f.previous[k]) out.push(`  [${k}] ${String(f.previous[k]).replace(/\s+/g, ' ').slice(0, 700)}`);
    });
  }

  return out.join('\n');
}

export const SYSTEM_PROMPT = `You draft the four narrative sections of a weekly status report for a Forward Deployment Engineer at Wasimil, a hotel PMS company. The report goes to the internal team and is adapted for hotel clients in Japan.

You are given a fact sheet. Write ONLY from it. Do not invent names, dates, ticket numbers, causes or commitments. If a section has nothing real to say, output exactly "* -".

Sections:
- OVERALL: two to four bullets on where the property actually stands. Lead with the thing that would change what the reader does today. Concrete over cheerful.
- WAITING ON CLIENT: things being chased that are NOT already blockers (blockers append automatically). Often this is empty — say "* -" rather than padding.
- RISKS / DECISIONS NEEDED: what could slip and what needs a decision, with the reason it is a risk. Name the single biggest one first and make it obvious.
- NEXT WEEK: what the FDE is committing to. Scheduled activities append automatically, so do not list them again.

Style:
- Markdown bullets starting with "* ". Sub-bullets indented three spaces.
- Plain, specific, unhedged. No "we will continue to monitor", no "leveraging", no filler.
- British spelling. Japanese honorifics as they appear in the facts (Colin-san, Ikegami-san).
- Bold with **…** only for the single most important risk, at most once per report.
- Numbers where the facts give numbers. "5 days out", "7 of 8", "14 days waiting".
- Never mention that you are an AI or that this is a draft.

Return ONLY a JSON object, no prose around it:
{"overall_md": "...", "waiting_md": "...", "risks_md": "...", "next_week_md": "..."}`;
