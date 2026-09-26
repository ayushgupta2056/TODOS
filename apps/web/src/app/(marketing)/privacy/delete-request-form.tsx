"use client";

import { Button, Field, Input, Textarea, toast } from "@glimpse/ui";
import { useState } from "react";

export function DeleteRequestForm({ defaultEvent = "" }: { defaultEvent?: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/privacy/delete-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: String(form.get("event") ?? ""),
        email: String(form.get("email") ?? ""),
        message: String(form.get("message") ?? ""),
      }),
    }).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "That didn't go through. Check your connection and try again.");
      return;
    }
    setDone(true);
    toast.success("Request received", "We'll confirm by email.");
  }

  if (done) {
    return (
      <p role="status" className="rounded-lg border border-line bg-surface p-5 text-paper">
        Request received. We&rsquo;ll email you when it&rsquo;s done.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-5 rounded-lg border border-line bg-surface p-5 sm:p-6" noValidate>
      <Field label="Event link or code" htmlFor="event" hint="For example glimpse.app/e/priya-arjun or priya-arjun">
        <Input id="event" name="event" required defaultValue={defaultEvent} autoComplete="off" />
      </Field>
      <Field label="Your email" htmlFor="email" hint="Only used to confirm the deletion." error={error ?? undefined}>
        <Input id="email" name="email" type="email" required autoComplete="email" aria-invalid={!!error} />
      </Field>
      <Field label="Anything that helps us find you (optional)" htmlFor="message">
        <Textarea id="message" name="message" maxLength={1000} placeholder="e.g. I was at the sangeet, wearing a green kurta" />
      </Field>
      <Button type="submit" loading={pending} className="justify-self-start">
        Send deletion request
      </Button>
    </form>
  );
}
