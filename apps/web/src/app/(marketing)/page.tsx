import { Button } from "@glimpse/ui";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Hero } from "@/components/marketing/hero";

const steps = [
  {
    n: "01",
    title: "Dump the shoot",
    body: "Drag in whole folders straight from your card. Thousands of files, resumable, uploaded directly to storage.",
  },
  {
    n: "02",
    title: "We find every face",
    body: "Each photo is processed once in the background. Faces are grouped into people, even in big group shots.",
  },
  {
    n: "03",
    title: "Guests find themselves",
    body: "Share a QR code at the venue. A guest takes a selfie and sees their photos in seconds, ready to download.",
  },
];

const privacy = [
  "Guests give explicit consent before the camera opens",
  "The selfie is used once, in memory, then discarded — never stored",
  "Face data lives only inside one event and is never searched across events",
  "Everything is deleted when the event expires or you delete it",
];

export default function HomePage() {
  return (
    <>
      <Hero face="serif" />

      <section id="how" className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
          <div className="mb-14 grid gap-4 lg:grid-cols-2">
            <h2 className="font-display text-display-lg">
              Three steps.
              <br />
              <em className="text-muted">None for the guest to learn.</em>
            </h2>
            <p className="max-w-md self-end text-muted lg:justify-self-end">
              Built for the night after the event, when you have 4,000 photos and 300 people asking
              &ldquo;can you send mine?&rdquo;
            </p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="grid gap-4 bg-ink p-7 sm:p-8">
                <span className="font-mono text-sm text-accent">{s.n}</span>
                <h3 className="font-display text-3xl">{s.title}</h3>
                <p className="text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:py-32">
          <div data-theme="dark" className="vignette grain relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-ink">
            <img src="/marketing/frame-6.webp" alt="" className="size-full object-cover" />
            <div className="absolute inset-0 z-[2] grid place-items-center">
              <p className="font-display text-display-md italic text-paper/90">Private by design.</p>
            </div>
          </div>
          <div className="grid content-center gap-8">
            <div className="grid gap-4">
              <p className="eyebrow">Privacy</p>
              <h2 className="font-display text-display-md">A face is not a password. We treat it with more care.</h2>
              <p className="text-muted">
                Designed around India&rsquo;s DPDP Act 2023 and GDPR principles: purpose-limited,
                consent-first, and deleted on schedule.
              </p>
            </div>
            <ul className="grid gap-3">
              {privacy.map((p) => (
                <li key={p} className="flex gap-3">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-green" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <Link href="/privacy" className="text-sm text-accent underline-offset-4 hover:underline">
              Read the privacy notice
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-7xl justify-items-start gap-8 px-4 py-24 sm:px-6 lg:py-32">
          <h2 className="max-w-3xl font-display text-display-lg">
            Your next event, <em className="text-accent">delivered</em> before the guests get home.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login?mode=signup">
                Start free <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
