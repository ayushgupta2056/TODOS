"use client";

import { Button, Field, Input } from "@glimpse/ui";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { publicEnv } from "@/lib/public-env";
import { supabaseBrowser } from "@/lib/supabase/client";

const emailSchema = z.email();

export function LoginForm({ next, initialError }: { next: string; initialError?: string | undefined }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(initialError);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError("Enter a valid email, like you@studio.com");
      return;
    }
    setPending(true);
    setError(undefined);
    const { error: err } = await supabaseBrowser().auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
    });
    setPending(false);
    if (err) {
      setError(err.status === 429 ? "Too many attempts. Wait a minute and try again." : err.message);
      return;
    }
    setSentTo(parsed.data);
  }

  async function google() {
    await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  if (sentTo) {
    return (
      <div role="status" className="grid gap-4 rounded-lg border border-line bg-surface p-6">
        <MailCheck aria-hidden className="size-6 text-accent" />
        <div className="grid gap-1">
          <p className="font-medium">Check your inbox</p>
          <p className="text-sm text-muted">
            We sent a sign-in link to <span className="text-paper">{sentTo}</span>. It works once and expires in an hour.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setSentTo(null)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {publicEnv.googleAuth ? (
        <>
          <Button variant="secondary" size="lg" onClick={google}>
            <svg viewBox="0 0 24 24" aria-hidden className="size-4">
              <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.47-1.67 4.3-5.35 4.3-3.22 0-5.85-2.67-5.85-5.96S8.78 6.46 12 6.46c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.7 3.93 14.6 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.59-.06-1.04-.29-1.1Z" />
            </svg>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}
      <form onSubmit={sendLink} className="grid gap-4" noValidate>
        <Field label="Work email" htmlFor="email" error={error}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@studio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "email-error" : undefined}
            required
          />
        </Field>
        <Button type="submit" size="lg" loading={pending}>
          Email me a sign-in link
        </Button>
      </form>
    </div>
  );
}
