"use client";

import { Button, Field, Input } from "@glimpse/ui";
import { useActionState } from "react";
import { createStudio } from "../actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createStudio, null);
  return (
    <form action={action} className="grid gap-5">
      <Field label="Studio name" htmlFor="name" error={state?.fieldErrors?.name ?? state?.error}>
        <Input id="name" name="name" placeholder="e.g. Golden Hour Studios" autoFocus required maxLength={80} />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Continue
      </Button>
    </form>
  );
}
