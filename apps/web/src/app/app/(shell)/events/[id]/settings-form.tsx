"use client";

import type { Row } from "@glimpse/db";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Switch, toast } from "@glimpse/ui";
import { useActionState, useEffect, useState } from "react";
import { deleteEvent, updateEventSettings } from "../../../actions";

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="grid gap-1">
        <label htmlFor={name} className="text-sm font-medium">
          {label}
        </label>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <Switch id={name} checked={on} onCheckedChange={setOn} />
      {on ? <input type="hidden" name={name} value="on" /> : null}
    </div>
  );
}

export function SettingsForm({ event, deleteMismatch }: { event: Row<"events">; deleteMismatch: boolean }) {
  const [state, action, pending] = useActionState(updateEventSettings, null);
  const [visibility, setVisibility] = useState(event.visibility);
  const fe = state?.fieldErrors ?? {};
  useEffect(() => {
    if (state?.ok) toast.success("Settings saved");
    else if (state?.error) toast.error(state.error);
  }, [state]);
  return (
    <div className="grid max-w-3xl gap-8">
      <form action={action}>
        <input type="hidden" name="id" value={event.id} />
        <Card>
          <CardHeader>
            <CardTitle>Event</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <Field label="Name" htmlFor="name" error={fe.name}>
              <Input id="name" name="name" defaultValue={event.name} required maxLength={120} />
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Date" htmlFor="event_date" error={fe.event_date}>
                <Input id="event_date" name="event_date" type="date" defaultValue={event.event_date ?? ""} />
              </Field>
              <Field label="Delete everything on" htmlFor="expires_at" error={fe.expires_at} hint="Photos and face data are permanently deleted.">
                <Input id="expires_at" name="expires_at" type="date" required defaultValue={(event.expires_at ?? new Date(Date.now() + 90 * 864e5).toISOString()).slice(0, 10)} />
              </Field>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Access" htmlFor="visibility">
                <select
                  id="visibility"
                  name="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as "public" | "pin")}
                  className="h-11 rounded-md border border-line-strong bg-surface px-3 text-[0.95rem] focus-visible:border-amber focus-visible:outline-none"
                >
                  <option value="public">Anyone with the link</option>
                  <option value="pin">Link + PIN</option>
                </select>
              </Field>
              {visibility === "pin" ? (
                <Field label={event.pin_hash ? "New PIN (leave blank to keep)" : "PIN"} htmlFor="pin" error={fe.pin}>
                  <Input id="pin" name="pin" inputMode="numeric" maxLength={8} className="font-mono tracking-[0.3em]" />
                </Field>
              ) : null}
            </div>
            <div className="divide-y divide-line border-y border-line">
              <Toggle name="allow_download" label="Guest downloads" hint="Let guests save photos and download a ZIP." defaultChecked={event.allow_download} />
              <Toggle name="watermark" label="Watermark" hint="Show and download a watermarked copy instead of the original." defaultChecked={event.watermark} />
              <Toggle name="show_all_gallery" label="Full gallery" hint="Also let guests browse every photo, not just their own." defaultChecked={event.show_all_gallery} />
            </div>
            <Button type="submit" loading={pending} className="justify-self-start">
              Save changes
            </Button>
          </CardContent>
        </Card>
      </form>

      <Card className="border-red/40">
        <CardHeader>
          <CardTitle>Delete this event</CardTitle>
          <CardDescription>
            Permanently deletes every photo and all face data. Guests lose access at once. This can&rsquo;t be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteEvent} className="grid gap-4">
            <input type="hidden" name="id" value={event.id} />
            <Field label={`Type “${event.name}” to confirm`} htmlFor="confirm" error={deleteMismatch ? "That doesn't match the event name." : undefined}>
              <Input id="confirm" name="confirm" autoComplete="off" required />
            </Field>
            <Button type="submit" variant="danger" className="justify-self-start">
              Delete event and all photos
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
