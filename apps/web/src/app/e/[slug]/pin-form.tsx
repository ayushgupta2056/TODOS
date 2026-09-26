"use client";

import { Button, Field, Input } from "@glimpse/ui";
import { Lock } from "lucide-react";
import { useActionState } from "react";
import { unlockEvent } from "./actions";

export function PinForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(unlockEvent, null);
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-line bg-surface/85 p-5 backdrop-blur">
      <input type="hidden" name="slug" value={slug} />
      <p className="flex items-center gap-2 text-sm text-muted">
        <Lock className="size-4" aria-hidden /> This event is private. Enter the PIN from the card at the venue.
      </p>
      <Field label="Event PIN" htmlFor="pin" error={state?.error}>
        <Input
          id="pin"
          name="pin"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4,8}"
          maxLength={8}
          required
          className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
          aria-invalid={!!state?.error}
        />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Unlock
      </Button>
    </form>
  );
}
