import { Button, EmptyState } from "@glimpse/ui";
import { Camera, ScanFace } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatCount } from "@/lib/format";
import { getGuestMatches, getPublicEvent, hasEventAccess } from "@/lib/guest";
import { forgetMe } from "../actions";
import { Gallery } from "../gallery";
import { loadGuestPhotos } from "../gallery-data";

export const metadata = { title: "My photos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyPhotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await getPublicEvent(slug);
  if (!ev) notFound();
  if (!(await hasEventAccess(ev))) redirect(`/e/${slug}`);
  const matches = await getGuestMatches(ev.id);
  if (!matches) redirect(`/e/${slug}/consent`);
  const photos = await loadGuestPhotos(ev, matches.photoIds);

  return (
    <main className="mx-auto max-w-7xl px-3 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="mb-8 grid gap-4 px-1 pt-2">
        <Link href={`/e/${slug}`} className="-ml-2 self-start rounded-md px-2 py-2.5 text-sm text-muted hover:text-paper">
          ← {ev.name}
        </Link>
        <h1 className="font-display text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.95]">
          {photos.length ? (
            <>
              You&rsquo;re in <em className="text-amber">{formatCount(photos.length)}</em> photo{photos.length === 1 ? "" : "s"}
            </>
          ) : (
            "Your photos"
          )}
        </h1>
      </header>
      {photos.length ? (
        <Gallery slug={slug} eventName={ev.name} photos={photos} allowDownload={ev.allow_download} showZip />
      ) : (
        <EmptyState
          icon={<ScanFace />}
          title={matches.searchedAt ? "Nothing here right now" : "Take a selfie to begin"}
          description={
            matches.searchedAt
              ? "Your results expire after 24 hours, or we didn't find you yet. Try another selfie — new photos may have been added."
              : "We'll show every photo you appear in."
          }
          action={
            <Button asChild>
              <Link href={`/e/${slug}/find`}>
                <Camera /> Take a selfie
              </Link>
            </Button>
          }
        />
      )}
      <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line px-1 pt-6 text-sm text-muted">
        <p>
          Not you in some of these? <Link href={`/e/${slug}/find`} className="text-paper underline underline-offset-2">Search again</Link>
        </p>
        <form action={forgetMe}>
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className="rounded-md py-2.5 underline underline-offset-2 hover:text-paper">
            Clear my results
          </button>
        </form>
      </footer>
    </main>
  );
}
