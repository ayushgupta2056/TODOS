"use client";

import { Badge, Button, Card, CardContent, Field, Input, toast } from "@glimpse/ui";
import { useActionState, useEffect, useState } from "react";
import { updateBrand } from "../../actions";

export function BrandForm({ name, color, custom }: { name: string; color: string; custom: boolean }) {
  const [state, action, pending] = useActionState(updateBrand, null);
  const [c, setC] = useState(color);
  useEffect(() => {
    if (state?.ok) toast.success("Brand saved");
  }, [state]);
  return (
    <form action={action}>
      <Card>
        <CardContent className="grid gap-6">
          <Field label="Studio name" htmlFor="name" error={state?.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={name} required maxLength={80} />
          </Field>
          <Field
            label="Accent colour"
            htmlFor="brand_color"
            error={state?.fieldErrors?.brand_color}
            hint={custom ? "Used for buttons and highlights on your guest pages." : undefined}
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Pick accent colour"
                value={c}
                disabled={!custom}
                onChange={(e) => setC(e.target.value)}
                className="size-11 cursor-pointer rounded-md border border-control bg-surface p-1 disabled:cursor-not-allowed"
              />
              <Input id="brand_color" name="brand_color" value={c} onChange={(e) => setC(e.target.value)} disabled={!custom} className="max-w-36 font-mono uppercase" />
              {!custom ? <Badge tone="amber">Pro &amp; Studio</Badge> : null}
            </div>
          </Field>
          {!custom ? <input type="hidden" name="brand_color" value={color} /> : null}
          <Button type="submit" loading={pending} className="justify-self-start">
            Save
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
