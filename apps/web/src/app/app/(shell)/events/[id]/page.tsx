import { Badge, cn } from "@glimpse/ui";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { requireOwnedEvent } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { mintUploadToken } from "@/lib/upload-token";
import { PhotosPane } from "./photos-pane";
import { ProcessingPanel } from "./processing-panel";
import { SettingsForm } from "./settings-form";
import { SharePanel } from "./share-panel";
import { Uploader } from "./uploader";

const TABS = [
  { id: "photos", label: "Photos" },
  { id: "share", label: "Share" },
  { id: "settings", label: "Settings" },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ev = await requireOwnedEvent(id);
  return { title: ev.name };
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; delete?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ev = await requireOwnedEvent(id);
  const tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as (typeof TABS)[number]["id"]) : "photos";
  const url = `${env().APP_URL}/e/${ev.slug}`;
  const [uploadToken, qrSvg] = await Promise.all([
    mintUploadToken(ev.studio_id, ev.id),
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0E0C0A", light: "#F3EDE4" } }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Link href="/app" className="eyebrow hover:text-paper">
            ← Events
          </Link>
          <h1 className="font-display text-display-md">{ev.name}</h1>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            {ev.event_date ? <span>{formatDate(ev.event_date)}</span> : null}
            {ev.visibility === "pin" ? <Badge>PIN protected</Badge> : <Badge>Public link</Badge>}
            {ev.expires_at ? <span>Deletes {formatDate(ev.expires_at)}</span> : null}
          </div>
        </div>
        <a
          href={`/e/${ev.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 text-sm hover:border-paper/50"
        >
          Open guest page <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>

      <nav aria-label="Event sections" className="mb-8 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/app/events/${ev.id}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 text-sm transition-colors",
              tab === t.id ? "border-amber text-paper" : "border-transparent text-muted hover:text-paper",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "photos" ? (
        <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
          <div className="grid min-w-0 content-start gap-8">
            <Uploader eventId={ev.id} token={uploadToken} />
            <PhotosPane eventId={ev.id} />
          </div>
          <ProcessingPanel
            eventId={ev.id}
            initial={{
              photo_count: ev.photo_count,
              processed_count: ev.processed_count,
              failed_count: ev.failed_count,
              face_count: ev.face_count,
              people_count: ev.people_count,
            }}
          />
        </div>
      ) : null}
      {tab === "share" ? <SharePanel url={url} slug={ev.slug} name={ev.name} qrSvg={qrSvg} pin={ev.visibility === "pin"} /> : null}
      {tab === "settings" ? <SettingsForm event={ev} deleteMismatch={sp.delete === "mismatch"} /> : null}
    </div>
  );
}
