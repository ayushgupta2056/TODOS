import { Badge, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Logo, LogoMark } from "@glimpse/ui";
import type { Metadata } from "next";
import { HeroHeadline } from "@/components/marketing/hero";
import { ThemeToggle } from "@/components/theme-toggle";
import { Interactive } from "./interactive";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

const swatches = [
  ["ink", "Background", "--ink"],
  ["surface", "Surface", "--surface"],
  ["raised", "Raised", "--raised"],
  ["line", "Line", "--line"],
  ["paper", "Text", "--paper"],
  ["muted", "Muted text", "--muted"],
  ["amber", "Safelight amber · primary", "--amber"],
  ["red", "Developer red · destructive", "--red"],
  ["green", "Fixer green · success", "--green"],
] as const;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line py-14">
      <div className="grid gap-1">
        <h2 className="font-display text-4xl">{title}</h2>
        {note ? <p className="max-w-2xl text-sm text-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <ThemeToggle />
      </header>
      <div className="grid gap-4 py-16">
        <p className="eyebrow">Glimpse design system</p>
        <h1 className="font-display text-display-lg">Darkroom</h1>
        <p className="max-w-2xl text-muted">
          Premium, cinematic, calm. Photos are the hero; the interface is the darkroom around them. Every screen uses only
          the components on this page. Decisions and rationale: <code className="font-mono text-paper">docs/design-decisions.md</code>.
        </p>
      </div>

      <Section title="Display face" note="Two candidates, same headline. Instrument Serif is the default; Barlow Condensed was the alternative suggested earlier.">
        <div className="grid gap-4 lg:grid-cols-2">
          {(["serif", "condensed"] as const).map((f) => (
            <div key={f} data-theme="dark" className="grain vignette relative overflow-hidden rounded-lg border border-line bg-ink text-paper">
              <img src="/marketing/frame-5.webp" alt="" className="absolute inset-0 size-full object-cover opacity-35" />
              <div className="relative z-[2] grid gap-4 p-8 sm:p-10">
                <Badge tone={f === "serif" ? "amber" : "neutral"} className="justify-self-start">{f === "serif" ? "A · Instrument Serif (chosen)" : "B · Barlow Condensed"}</Badge>
                <HeroHeadline face={f} className={f === "serif" ? "text-[clamp(2.8rem,5.5vw,5rem)]" : "text-[clamp(2.6rem,5vw,4.6rem)]"} />
                <p className="max-w-sm text-sm text-muted">Upload the whole shoot once. Guests take a selfie and see only their photos.</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Colour" note="Dark-first. All text pairs meet WCAG AA; paper on ink is 17:1, muted on ink 7.3:1, ink on amber 8.9:1.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {swatches.map(([k, label, v]) => (
            <div key={k} className="overflow-hidden rounded-md border border-line">
              <div className="h-20" style={{ background: `var(${v})` }} />
              <div className="grid gap-0.5 p-3">
                <p className="text-sm font-medium">{label}</p>
                <p className="font-mono text-xs text-muted">{v}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="grid gap-5">
          <p className="font-display text-display-xl">Display XL</p>
          <p className="font-display text-display-lg">Display large, <em className="text-accent">italic accent</em></p>
          <p className="font-display text-display-md">Display medium</p>
          <p className="text-lg">Geist Sans 18 — body lead. Quiet, legible, neutral.</p>
          <p className="text-sm text-muted">Geist Sans 14 — secondary text and hints.</p>
          <p className="font-mono text-sm">Geist Mono — 4,218 photos · IMG_0412.CR3</p>
          <p className="eyebrow">Eyebrow · mono caps</p>
        </div>
      </Section>

      <Interactive />

      <Section title="Cards & badges">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Surface on ink, 1px line, 14px radius.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="amber" dot>Processing</Badge>
              <Badge tone="success" dot>Live</Badge>
              <Badge tone="danger">Unreadable</Badge>
            </CardContent>
            <CardFooter className="text-sm text-muted">Footer</CardFooter>
          </Card>
          <Card className="grid place-items-center gap-4 p-8">
            <LogoMark className="size-16" />
            <Logo />
          </Card>
        </div>
      </Section>
    </main>
  );
}
