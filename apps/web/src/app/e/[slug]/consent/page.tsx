import { Camera, Clock, EyeOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPublicEvent, hasEventAccess } from "@/lib/guest";
import { giveConsent } from "../actions";
import { ConsentControls } from "./consent-controls";

export const metadata = { title: "Before we start", robots: { index: false } };

export default async function ConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ required?: string; error?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ev = await getPublicEvent(slug);
  if (!ev) notFound();
  if (!(await hasEventAccess(ev))) redirect(`/e/${slug}`);

  const points = [
    { icon: Camera, title: "One selfie, used once", body: "We compare it with the faces in this event's photos to find yours." },
    { icon: EyeOff, title: "Never stored", body: "The selfie stays in memory for a few seconds, then it's gone. It isn't saved anywhere, or shown to anyone." },
    { icon: Clock, title: "Only this event", body: `We never search other events. Your list of matches is kept for 24 hours so you can download them.` },
    { icon: Trash2, title: "You're in control", body: "You can clear your results any time, or ask for face data about you to be deleted from this event." },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
      <Link href={`/e/${slug}`} className="-ml-2 self-start rounded-md px-2 py-2.5 text-sm text-muted hover:text-paper">
        ← {ev.name}
      </Link>
      <div className="mt-6 grid gap-3">
        <p className="eyebrow">Before we open the camera</p>
        <h1 className="font-display text-5xl leading-[0.98]">Here&rsquo;s exactly what happens to your face.</h1>
      </div>
      <ul className="mt-8 grid gap-5">
        {points.map((p) => (
          <li key={p.title} className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-amber">
              <p.icon className="size-4" aria-hidden />
            </span>
            <div className="grid gap-0.5">
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-muted">{p.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        Photos are shared by <span className="text-paper">{ev.studio_name}</span>. Glimpse processes them on their behalf.{" "}
        <Link href="/privacy" className="text-paper underline underline-offset-2">
          Full privacy notice
        </Link>
      </p>
      <form action={giveConsent} className="mt-auto grid gap-4 pt-8">
        <input type="hidden" name="slug" value={slug} />
        <ConsentControls error={sp.required ? "Please tick the box to continue." : sp.error ? "Something went wrong. Try again." : undefined} />
      </form>
    </main>
  );
}
