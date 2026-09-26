import { Button, cn } from "@glimpse/ui";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HeroDemo } from "./hero-demo";

export type DisplayFace = "serif" | "condensed";

export function HeroHeadline({ face, className }: { face: DisplayFace; className?: string }) {
  if (face === "condensed") {
    return (
      <h1
        className={cn(
          "font-condensed text-[clamp(3.2rem,8.5vw,7.6rem)] font-semibold uppercase leading-[0.88] tracking-[-0.01em]",
          className,
        )}
      >
        Every guest
        <br />
        finds <span className="text-amber">themselves.</span>
      </h1>
    );
  }
  return (
    <h1 className={cn("font-display text-display-xl", className)}>
      Every guest
      <br />
      finds <em className="text-amber">themselves.</em>
    </h1>
  );
}

export function Hero({ face = "serif" }: { face?: DisplayFace }) {
  return (
    <section className="grain relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-32 lg:pt-28">
        <div className="grid gap-7">
          <p className="eyebrow animate-fade-up">For wedding, fest &amp; event photographers</p>
          <HeroHeadline face={face} className="animate-fade-up [animation-delay:60ms]" />
          <p className="max-w-lg text-lg text-muted animate-fade-up [animation-delay:120ms]">
            Upload the whole shoot once. Guests scan a QR code, take a selfie, and see only the photos
            they&rsquo;re in. No app, no sign-up, no searching through 3,000 frames.
          </p>
          <div className="flex flex-wrap items-center gap-3 animate-fade-up [animation-delay:180ms]">
            <Button asChild size="lg">
              <Link href="/login?mode=signup">
                Start free — 500 photos <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="#how">See how it works</Link>
            </Button>
          </div>
          <p className="font-mono text-xs text-faint animate-fade-up [animation-delay:240ms]">
            Selfies are never stored · Face data deleted with the event
          </p>
        </div>
        <HeroDemo />
      </div>
    </section>
  );
}
