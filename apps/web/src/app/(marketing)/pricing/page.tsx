import { Badge, Button, cn } from "@glimpse/ui";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatCount } from "@/lib/format";
import { getPlans } from "@/lib/plans";

export const metadata: Metadata = { title: "Pricing" };
export const revalidate = 3600;

export default async function PricingPage() {
  const plans = await getPlans();
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="mb-14 grid max-w-2xl gap-4">
        <p className="eyebrow">Pricing</p>
        <h1 className="font-display text-display-lg">Pay for photos, not for guests.</h1>
        <p className="text-muted">
          Unlimited guests and searches on every plan. Prices in INR, billed monthly, cancel any time.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const featured = p.id === "pro";
          return (
            <section
              key={p.id}
              aria-labelledby={`plan-${p.id}`}
              className={cn(
                "flex flex-col gap-6 rounded-lg border bg-surface p-6",
                featured ? "border-amber/60" : "border-line",
              )}
            >
              <div className="flex items-center justify-between">
                <h2 id={`plan-${p.id}`} className="font-display text-3xl">
                  {p.name}
                </h2>
                {featured ? <Badge tone="amber">Most studios</Badge> : null}
              </div>
              <p>
                <span className="font-display text-5xl">{p.price_inr_monthly === 0 ? "Free" : `₹${formatCount(p.price_inr_monthly)}`}</span>
                {p.price_inr_monthly > 0 ? <span className="text-muted"> / month</span> : null}
              </p>
              <ul className="grid gap-2.5 text-sm">
                <li className="flex gap-2.5"><Check aria-hidden className="size-4 shrink-0 text-green" />{formatCount(p.photos_per_month)} photos{p.id === "trial" ? " total" : " / month"}</li>
                <li className="flex gap-2.5"><Check aria-hidden className="size-4 shrink-0 text-green" />{p.storage_gb} GB storage</li>
                <li className="flex gap-2.5"><Check aria-hidden className="size-4 shrink-0 text-green" />{p.active_events === null ? "Unlimited" : p.active_events} active event{p.active_events === 1 ? "" : "s"}</li>
                <li className="flex gap-2.5"><Check aria-hidden className="size-4 shrink-0 text-green" />Unlimited guests &amp; downloads</li>
                <li className={cn("flex gap-2.5", !p.custom_branding && "text-faint")}>
                  <Check aria-hidden className={cn("size-4 shrink-0", p.custom_branding ? "text-green" : "opacity-30")} />
                  {p.custom_branding ? "Your logo & colours" : "Glimpse branding"}
                </li>
              </ul>
              <Button asChild variant={featured ? "primary" : "secondary"} className="mt-auto">
                <Link href="/login?mode=signup">{p.id === "trial" ? "Start free" : `Choose ${p.name}`}</Link>
              </Button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
