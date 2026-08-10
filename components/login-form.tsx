'use client';

import * as React from 'react';
import { browserSupabase } from '@/lib/supabase/client';
import { ALLOWED_DOMAIN } from '@/lib/config';
import { Button, Card, Field, FieldControl, FieldLabel, Input, toast } from '@/components/ui';

/**
 * Magic link only. There are three of us and no password worth storing; the
 * domain check is a courtesy so a typo does not silently email a stranger.
 */
export function LoginForm() {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return toast.error(`Use your @${ALLOWED_DOMAIN} address`);
    }
    setBusy(true);
    const supabase = browserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    setBusy(false);
    if (error) return toast.error('Could not send the link', { description: error.message });
    setSent(true);
  }

  if (sent) {
    return (
      <Card className="p-6 text-center">
        <p className="text-[13px]">Check {email} for a sign-in link.</p>
        <button onClick={() => setSent(false)} className="mt-2 text-[12px] text-sub underline">
          use a different address
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-3.5">
        <Field>
          <FieldLabel hint={`@${ALLOWED_DOMAIN} only`}>Email</FieldLabel>
          <FieldControl>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`you@${ALLOWED_DOMAIN}`}
            />
          </FieldControl>
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          Send sign-in link
        </Button>
      </form>
    </Card>
  );
}
