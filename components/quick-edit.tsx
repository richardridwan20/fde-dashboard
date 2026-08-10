'use client';

// Inline edits that write immediately. Each one shows a spinner beside the
// control while the write is in flight and raises a toast from the action's
// { ok, message } — no silent no-ops.

import * as React from 'react';
import { Button, Checkbox, Input, Select, Spinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

type Result = { ok: boolean; message: string };

function useWrite() {
  const [pending, start] = React.useTransition();
  const write = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error('Nothing was saved', { description: r.message });
    });
  return { pending, write };
}

export function QuickSelect({
  value,
  options,
  onSave,
  className,
  placeholder
}: {
  value?: string | null;
  options: { value: string; label: string }[];
  onSave: (v: string) => Promise<Result>;
  className?: string;
  placeholder?: string;
}) {
  const { pending, write } = useWrite();
  return (
    <span className="inline-flex items-center gap-1.5">
      <Select
        value={value || undefined}
        options={options}
        placeholder={placeholder}
        disabled={pending}
        onValueChange={(v) => write(() => onSave(v))}
        className={cn('h-8 w-auto min-w-[8rem] text-[12px]', className)}
      />
      {pending && <Spinner className="text-faint" />}
    </span>
  );
}

/** Commits on blur or Enter, and only when the value actually changed. */
export function QuickText({
  value,
  onSave,
  placeholder,
  type = 'text',
  className
}: {
  value?: string | null;
  onSave: (v: string) => Promise<Result>;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  const { pending, write } = useWrite();
  const [draft, setDraft] = React.useState(value || '');
  React.useEffect(() => setDraft(value || ''), [value]);

  const commit = () => {
    if ((draft || '') === (value || '')) return;
    write(() => onSave(draft));
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <Input
        type={type}
        value={draft}
        placeholder={placeholder}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(value || '');
        }}
        className={cn('h-8 text-[12px]', className)}
      />
      {pending && <Spinner className="text-faint" />}
    </span>
  );
}

export const QuickDate = (p: Omit<Parameters<typeof QuickText>[0], 'type'>) => (
  <QuickText {...p} type="date" className={cn('w-[9.5rem]', p.className)} />
);

export function QuickTick({
  checked,
  label,
  onSave
}: {
  checked: boolean;
  label: string;
  onSave: (v: boolean) => Promise<Result>;
}) {
  const { pending, write } = useWrite();
  return (
    <span className="inline-flex items-center gap-2">
      <Checkbox checked={checked} disabled={pending} onCheckedChange={(v) => write(() => onSave(v))} />
      <span className={cn('text-[13px]', checked && 'text-faint line-through')}>{label}</span>
      {pending && <Spinner className="text-faint" />}
    </span>
  );
}

/**
 * Two-tap destructive action. Deleting a photo or removing a device used to be
 * one irreversible click; this arms first and disarms itself after 4 seconds.
 */
export function ConfirmButton({
  onConfirm,
  children = 'delete',
  confirmLabel = 'Confirm delete',
  size = 'xs',
  className
}: {
  onConfirm: () => Promise<Result>;
  children?: React.ReactNode;
  confirmLabel?: string;
  size?: 'xs' | 'sm' | 'default';
  className?: string;
}) {
  const { pending, write } = useWrite();
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      type="button"
      size={size}
      variant={armed ? 'destructive' : 'ghost'}
      loading={pending}
      className={cn(!armed && 'text-faint hover:text-destructive', className)}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        write(onConfirm);
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}

/** A plain button that runs a server action and toasts the result. */
export function ActionButton({
  onRun,
  children,
  variant = 'outline',
  size = 'xs',
  className
}: {
  onRun: () => Promise<Result>;
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'xs' | 'sm' | 'default';
  className?: string;
}) {
  const { pending, write } = useWrite();
  return (
    <Button type="button" variant={variant} size={size} loading={pending} className={className} onClick={() => write(onRun)}>
      {children}
    </Button>
  );
}
