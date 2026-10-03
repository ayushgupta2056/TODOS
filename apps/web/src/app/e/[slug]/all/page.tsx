import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatCount } from "@/lib/format";
import { getPublicEvent, hasEventAccess } from "@/lib/guest";
import { Gallery } from "../gallery";
import { loadGuestPhotos } from "../gallery-data";

export const metadata = { title: "All photos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AllPhotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await getPublicEvent(slug);
  if (!ev) notFound();
  if (!ev.show_all_gallery) redirect(`/e/${slug}`);
  if (!(await hasEventAccess(ev))) redirect(`/e/${slug}`);
  const photos = await loadGuestPhotos(ev, "all", 1000);
  return (
    <main className="mx-auto max-w-7xl px-3 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="mb-8 grid gap-4 px-1 pt-2">
        <Link href={`/e/${slug}`} className="-ml-2 self-start rounded-md px-2 py-2.5 text-sm text-muted hover:text-paper">
          ← {ev.name}
        </Link>
        <h1 className="font-display text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.95]">All photos</h1>
        <p className="font-mono text-sm text-muted">{formatCount(photos.length)} photos</p>
      </header>
      <Gallery slug={slug} eventName={ev.name} photos={photos} allowDownload={ev.allow_download} showZip={false} />
    </main>
  );
}
