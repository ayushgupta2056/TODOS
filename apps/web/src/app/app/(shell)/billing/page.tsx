import { Badge, Button, Card, CardContent, Progress, cn } from "@glimpse/ui";
import { requireStudio } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatBytes, formatCount } from "@/lib/format";
import { getPlans, getUsage } from "@/lib/plans";

export const metadata = { title: "Plan & usage" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const studio = await requireStudio();
  const sp = await searchParams;
  const [usage, plans] = await Promise.all([getUsage(studio), getPlans()]);
  const paymentsReady = !!(env().RAZORPAY_KEY_ID && env().RAZORPAY_KEY_SECRET);
  const meters = [
    {
      label: studio.plan === "trial" ? "Photos (trial total)" : "Photos this month",
      used: usage.photosThisMonth,
      max: usage.plan.photos_per_month,
      fmt: formatCount,
    },
    { label: "Storage", used: usage.storageBytes, max: usage.plan.storage_gb * 1024 ** 3, fmt: formatBytes },
    ...(usage.plan.active_events !== null
      ? [{ label: "Active events", used: usage.activeEvents, max: usage.plan.active_events, fmt: formatCount }]
      : []),
  ];
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-8 lg:py-12">
      <div className="grid gap-2">
        <p className="eyebrow">Plan &amp; usage</p>
        <h1 className="font-display text-display-md">
          You&rsquo;re on <em className="text-accent">{usage.plan.name}</em>
        </h1>
      </div>
      {sp.status === "pending" ? (
        <p role="status" className="rounded-md border border-line bg-surface p-4 text-sm">
          Payment started. Your plan updates as soon as Razorpay confirms it.
        </p>
      ) : null}
      <Card>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          {meters.map((m) => (
            <div key={m.label} className="grid gap-2.5">
              <p className="text-sm text-muted">{m.label}</p>
              <p className="font-mono text-lg tabular">
                {m.fmt(m.used)} <span className="text-muted">/ {m.fmt(m.max)}</span>
              </p>
              <Progress value={(m.used / Math.max(1, m.max)) * 100} label={m.label} />
            </div>
          ))}
        </CardContent>
      </Card>
      <section aria-labelledby="plans" className="grid gap-5">
        <h2 id="plans" className="font-display text-3xl">
          Plans
        </h2>
        {!paymentsReady ? (
          <p className="text-sm text-muted">
            Online payments aren&rsquo;t switched on for this installation yet. Write to us to upgrade during the pilot.
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const current = p.id === studio.plan;
            return (
              <div key={p.id} className={cn("grid gap-4 rounded-lg border bg-surface p-5", current ? "border-amber/60" : "border-line")}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl">{p.name}</h3>
                  {current ? <Badge tone="amber">Current</Badge> : null}
                </div>
                <p className="font-mono text-sm text-muted">
                  {p.price_inr_monthly ? `₹${formatCount(p.price_inr_monthly)}/mo` : "Free"} · {formatCount(p.photos_per_month)} photos · {p.storage_gb} GB
                </p>
                {!current && p.id !== "trial" ? (
                  <form action="/api/billing/checkout" method="post">
                    <input type="hidden" name="plan" value={p.id} />
                    <Button type="submit" variant="secondary" className="w-full" disabled={!paymentsReady}>
                      Switch to {p.name}
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
