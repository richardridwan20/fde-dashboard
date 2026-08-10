'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { saveWeeklyNarrative } from '@/lib/actions';
import { Button, Field, FieldControl, FieldLabel, Textarea, toast } from '@/components/ui';

/**
 * The generated half of the report is read-only — it comes from blockers,
 * ClickUp and meetings. The four narrative sections are yours; they save to
 * fde.weekly_reports keyed by property and week, so last week's writing stays
 * where you left it.
 */
export function ReportPanel({
  markdown,
  propertyId,
  weekStart,
  narrative
}: {
  markdown: string;
  propertyId: string;
  weekStart: string;
  narrative: any;
}) {
  const [copied, setCopied] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState({
    overall_md: narrative?.overall_md || '',
    waiting_md: narrative?.waiting_md || '',
    risks_md: narrative?.risks_md || '',
    next_week_md: narrative?.next_week_md || ''
  });

  React.useEffect(() => {
    setValues({
      overall_md: narrative?.overall_md || '',
      waiting_md: narrative?.waiting_md || '',
      risks_md: narrative?.risks_md || '',
      next_week_md: narrative?.next_week_md || ''
    });
  }, [narrative, weekStart, propertyId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not reach the clipboard', { description: 'Select the text and copy it.' });
    }
  }

  async function save() {
    setSaving(true);
    const r = await saveWeeklyNarrative(propertyId, weekStart, values);
    setSaving(false);
    if (r.ok) toast.success(r.message);
    else toast.error('Nothing was saved', { description: r.message });
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const SECTIONS: [keyof typeof values, string, string][] = [
    ['overall_md', 'OVERALL', 'One or two lines on where this property actually stands.'],
    ['waiting_md', 'WAITING ON CLIENT', 'Anything you are chasing them for. Client-blocked blockers append automatically.'],
    ['risks_md', 'RISKS / DECISIONS NEEDED', 'What could slip, and what you need a decision on. Overdue critical blockers append automatically.'],
    ['next_week_md', 'NEXT WEEK', 'What you are committing to. Scheduled meetings append automatically.']
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3.5">
        <div className="text-[12px] font-medium text-sub">Your sections</div>
        {SECTIONS.map(([key, label, hint]) => (
          <Field key={key}>
            <FieldLabel hint={hint}>{label}</FieldLabel>
            <FieldControl>
              <Textarea rows={3} value={values[key]} onChange={set(key)} className="font-mono text-[12px]" />
            </FieldControl>
          </Field>
        ))}
        <Button size="sm" loading={saving} onClick={save}>
          Save narrative
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-sub">Generated report</span>
          <Button size="xs" variant="outline" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy markdown'}
          </Button>
        </div>
        <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-card p-4 font-mono text-[12px] leading-relaxed">
          {markdown}
        </pre>
        <p className="text-[11px] text-faint">
          Save the narrative to see it fold into the generated text.
        </p>
      </div>
    </div>
  );
}
