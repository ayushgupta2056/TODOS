import { Button, LogoMark } from "@glimpse/ui";
import { ArrowRight, Images, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCount, formatDate } from "@/lib/format";
import { getGuestMatches, getPublicEvent, hasEventAccess } from "@/lib/guest";
import { presignGet } from "@/lib/s3";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PinForm } from "./pin-form";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ forgotten?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ev = await getPublicEvent((await params).slug);
  return ev ? { title: ev.name, description: `Find your photos from ${ev.name} by ${ev.studio_name}.`, robots: { index: false } } : {};
}

async function coverUrl(eventId: string, coverKey: string | null): Promise<string | null> {
  if (coverKey) return presignGet(coverKey);
  const { data } = await supabaseAdmin()
    .from("photos")
    .select("r2_key_web, r2_key_web_wm")
    .eq("event_id", eventId)
    .eq("status", "done")
    .order("face_count", { ascending: false })
    .limit(1)
    .maybeSingle();
  const key = data?.r2_key_web_wm ?? data?.r2_key_web;
  return key ? presignGet(key) : null;
}

export default async function EventLanding({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const ev = await getPublicEvent(slug);
  if (!ev) notFound();
  const access = await hasEventAccess(ev);
  const [cover, matches] = await Promise.all([
    access ? coverUrl(ev.id, ev.cover_key) : Promise.resolve(null),
    access ? getGuestMatches(ev.id) : Promise.resolve(null),
  ]);
  const ready = ev.processed_count > 0;

  return (
    <main data-theme="dark" className="relative flex min-h-dvh flex-col bg-ink text-paper">
      <div className="vignette grain absolute inset-0 overflow-hidden">
        <img
          src={cover ?? "/marketing/frame-1.webp"}
          alt=""
          fetchPriority="low"
          decoding="async"
          className="size-full scale-105 object-cover opacity-70 blur-[1px] motion-safe:animate-develop"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/20" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <p className="text-sm text-paper/80">{ev.studio_name}</p>
        <LogoMark className="size-6 text-paper/70" title="Glimpse" />
      </header>

      <div className="relative z-10 mt-auto grid gap-7 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:mx-auto sm:w-full sm:max-w-xl sm:px-0 sm:pb-16">
        <div className="grid gap-3">
          {ev.event_date ? <p className="eyebrow text-paper/70">{formatDate(ev.event_date)}</p> : null}
          <h1 className="font-display text-[clamp(2.8rem,12vw,5rem)] leading-[0.95] tracking-tight">{ev.name}</h1>
          {access && ready ? (
            <p className="font-mono text-sm text-paper/70">{formatCount(ev.processed_count)} photos · find the ones you&rsquo;re in</p>
          ) : null}
        </div>

        {sp.forgotten ? (
          <p role="status" className="rounded-md border border-line bg-surface/80 p-4 text-sm backdrop-blur">
            Done. Your results on this device have been cleared.
          </p>
        ) : null}

        {!access ? (
          <PinForm slug={slug} />
        ) : !ready ? (
          <p className="rounded-md border border-line bg-surface/80 p-4 text-sm text-muted backdrop-blur">
            The photographer is still uploading. Come back a little later — this link will work.
          </p>
        ) : (
          <div className="grid gap-3">
            {matches?.photoIds.length ? (
              <Button asChild size="xl">
                <Link href={`/e/${slug}/me`}>
                  See my {formatCount(matches.photoIds.length)} photos <ArrowRight />
                </Link>
              </Button>
            ) : null}
            <Button asChild size="xl" variant={matches?.photoIds.length ? "secondary" : "primary"}>
              <Link href={matches?.sessionId ? `/e/${slug}/find` : `/e/${slug}/consent`}>
                {matches?.photoIds.length ? "Search again" : "Find my photos"} {matches?.photoIds.length ? null : <ArrowRight />}
              </Link>
            </Button>
            {ev.show_all_gallery ? (
              <Button asChild size="lg" variant="ghost">
                <Link href={`/e/${slug}/all`}>
                  <Images /> Browse all photos
                </Link>
              </Button>
            ) : null}
            <p className="flex items-start justify-center gap-2 pt-1 text-center text-xs text-paper/60">
              <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
              Your selfie is never stored. <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
