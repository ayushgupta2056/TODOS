"use client";

import { Button, cn } from "@glimpse/ui";
import { Check } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="xl" disabled={disabled} loading={pending}>
      Continue to camera
    </Button>
  );
}

export function ConsentControls({ error }: { error?: string | undefined }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
          agreed ? "border-amber bg-amber-soft" : "border-line-strong hover:border-muted/50",
        )}
      >
        <input
          type="checkbox"
          name="agree"
          value="yes"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="peer sr-only"
          aria-describedby={error ? "consent-error" : undefined}
        />
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-xs border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
            agreed ? "border-amber bg-amber text-amber-ink" : "border-line-strong",
          )}
        >
          {agreed ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        <span className="text-sm leading-relaxed">
          I agree to Glimpse using my selfie once to find photos of me in this event, as described above.
        </span>
      </label>
      {error ? (
        <p id="consent-error" role="alert" className="text-sm text-red">
          {error}
        </p>
      ) : null}
      <Submit disabled={!agreed} />
    </>
  );
}
