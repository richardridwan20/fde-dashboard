'use client';

// shadcn-style primitives, collapsed into one module. Every form in the app is
// react-hook-form + zodResolver + Controller over these, so the Field/FieldLabel/
// FieldError trio is the contract: labels bind by id, errors render underneath,
// and the control gets aria-invalid.

import * as React from 'react';
import * as RDialog from '@radix-ui/react-dialog';
import * as RSelect from '@radix-ui/react-select';
import * as RCheckbox from '@radix-ui/react-checkbox';
import * as RLabel from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { Toaster as SonnerToaster } from 'sonner';
import { cn } from '@/lib/utils';
// Tone helpers are plain functions in lib/ so server components can call them —
// anything exported from this file is a client reference. See lib/ui-helpers.ts.
import { severityTone } from '@/lib/ui-helpers';

export { toast } from 'sonner';

/* --------------------------------------------------------------- feedback */

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-lg border border-line bg-card text-[13px] text-ink shadow-sm',
          description: 'text-[12px] text-sub',
          actionButton: 'text-[12px]'
        }
      }}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-3.5 w-3.5 animate-spin', className)} aria-hidden />;
}

/* ----------------------------------------------------------------- button */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-line bg-card hover:bg-soft',
        ghost: 'hover:bg-soft',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-ink underline underline-offset-2 hover:no-underline'
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-2.5 text-[12px]',
        xs: 'h-7 px-2 text-[11px]',
        icon: 'h-8 w-8'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

/* ------------------------------------------------------------ text inputs */

const fieldBase =
  'w-full rounded-md border border-input bg-card px-2.5 text-[13px] text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-[invalid=true]:border-destructive';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'h-9', className)} {...props} />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-[80px] py-2 leading-relaxed', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/* ------------------------------------------------------------------ field */

const FieldCtx = React.createContext<{ id: string; invalid: boolean }>({ id: '', invalid: false });

export function Field({
  children,
  error,
  className
}: {
  children: React.ReactNode;
  error?: { message?: string } | string | null;
  className?: string;
}) {
  const id = React.useId();
  const message = typeof error === 'string' ? error : error?.message;
  return (
    <FieldCtx.Provider value={{ id, invalid: !!message }}>
      <div className={cn('space-y-1.5', className)}>
        {children}
        {message && (
          <p id={`${id}-error`} className="text-[11px] text-destructive">
            {message}
          </p>
        )}
      </div>
    </FieldCtx.Provider>
  );
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  const { id } = React.useContext(FieldCtx);
  return (
    <RLabel.Root htmlFor={id} className="flex items-baseline gap-2 text-[12px] font-medium text-sub">
      {children}
      {hint && <span className="font-normal text-faint">{hint}</span>}
    </RLabel.Root>
  );
}

/** Binds id + aria-invalid onto whatever control sits inside the Field. */
export function FieldControl({ children }: { children: React.ReactElement }) {
  const { id, invalid } = React.useContext(FieldCtx);
  return React.cloneElement(children, {
    id,
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? `${id}-error` : undefined
  } as any);
}

/* ----------------------------------------------------------------- select */

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled,
  className,
  id,
  'aria-invalid': ariaInvalid
}: {
  value?: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
}) {
  return (
    <RSelect.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <RSelect.Trigger
        id={id}
        aria-invalid={ariaInvalid}
        className={cn(fieldBase, 'flex h-9 items-center justify-between gap-2 text-left', className)}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-faint" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-popover shadow-md"
        >
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-[13px] outline-none data-[highlighted]:bg-soft"
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <RSelect.ItemIndicator>
                    <Check className="h-3.5 w-3.5" />
                  </RSelect.ItemIndicator>
                </span>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

/* --------------------------------------------------------------- checkbox */

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  id,
  className
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <RCheckbox.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className
      )}
    >
      <RCheckbox.Indicator>
        <Check className="h-3 w-3" />
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
}

/* ----------------------------------------------------------------- dialog */

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  wide
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]" />
        {/* Sized off the viewport so it still works on a phone. */}
        <RDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-line bg-card shadow-lg',
            wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
            <div>
              <RDialog.Title className="text-[14px] font-medium">{title}</RDialog.Title>
              {description && (
                <RDialog.Description className="mt-0.5 text-[12px] text-sub">
                  {description}
                </RDialog.Description>
              )}
            </div>
            <RDialog.Close className="rounded p-1 text-faint hover:bg-soft hover:text-ink">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </RDialog.Close>
          </div>
          <div className="overflow-y-auto px-4 py-4">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export const DialogClose = RDialog.Close;

/* ------------------------------------------------------------------ shell */

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-lg border border-line bg-card', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, right, sub }: { title: React.ReactNode; right?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
      <div>
        <h2 className="text-[13px] font-medium">{title}</h2>
        {sub && <div className="text-[11px] text-faint">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-[13px] text-faint">{children}</div>;
}

/** Tables have up to seven columns; scroll rather than squash on a phone. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

/* ------------------------------------------------------------------ pills */

const TONES: Record<string, string> = {
  neutral: 'bg-soft text-sub',
  good: 'bg-emerald-50 text-emerald-800',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-800',
  info: 'bg-sky-50 text-sky-800'
};

export function Pill({
  children,
  tone = 'neutral',
  className
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}

export function SeverityLegend() {
  return (
    <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
      {['critical', 'high', 'medium', 'low'].map((s) => (
        <Pill key={s} tone={severityTone(s)}>
          {s}
        </Pill>
      ))}
    </span>
  );
}
