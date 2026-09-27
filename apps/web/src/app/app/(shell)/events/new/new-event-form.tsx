"use client";

import { Button, Field, Input, cn } from "@glimpse/ui";
import { Globe, Lock } from "lucide-react";
import { useActionState, useState } from "react";
import { createEvent } from "../../../actions";

export function NewEventForm() {
  const [state, action, pending] = useActionState(createEvent, null);
  const [visibility, setVisibility] = useState<"public" | "pin">("public");
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-7">
      {state?.error ? (
        <p role="alert" className="rounded-md border border-red/40 bg-red-soft p-4 text-sm">
          {state.error}
        </p>
      ) : null}
      <Field label="Event name" htmlFor="name" error={fe.name} hint="Guests see this. e.g. “Priya & Arjun — Sangeet”">
        <Input id="name" name="name" required maxLength={120} autoFocus />
      </Field>
      <Field label="Date" htmlFor="event_date" error={fe.event_date}>
        <Input id="event_date" name="event_date" type="date" className="max-w-56" />
      </Field>
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Who can open it</legend>
        <input type="hidden" name="visibility" value={visibility} />
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Who can open it">
          {(
            [
              { v: "public", icon: Globe, title: "Anyone with the link", body: "Best for weddings and parties." },
              { v: "pin", icon: Lock, title: "Link + PIN", body: "For corporate or private events." },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={visibility === o.v}
              onClick={() => setVisibility(o.v)}
              className={cn(
                "grid gap-1.5 rounded-lg border p-4 text-left transition-colors",
                visibility === o.v ? "border-amber bg-amber-soft" : "border-line-strong hover:border-muted/50",
              )}
            >
              <o.icon className={cn("size-4", visibility === o.v ? "text-accent" : "text-muted")} aria-hidden />
              <span className="text-sm font-medium">{o.title}</span>
              <span className="text-sm text-muted">{o.body}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {visibility === "pin" ? (
        <Field label="PIN" htmlFor="pin" error={fe.pin} hint="4–8 digits. Print it on the QR card.">
          <Input id="pin" name="pin" inputMode="numeric" pattern="\d{4,8}" maxLength={8} className="max-w-40 font-mono tracking-[0.3em]" />
        </Field>
      ) : null}
      <Field label="Delete everything after" htmlFor="expires_in_days" hint="Photos and face data are permanently deleted on this schedule. You can change it later.">
        <select
          id="expires_in_days"
          name="expires_in_days"
          defaultValue="90"
          className="h-11 max-w-56 rounded-md border border-control bg-surface px-3 text-[0.95rem] text-paper focus-visible:border-amber focus-visible:outline-none"
        >
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="180">6 months</option>
          <option value="365">1 year</option>
        </select>
      </Field>
      <Button type="submit" size="lg" loading={pending} className="justify-self-start">
        Create event
      </Button>
    </form>
  );
}
