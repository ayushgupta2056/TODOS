import { Badge, Button, EmptyState } from "@glimpse/ui";
import { CalendarDays, Images, Plus } from "lucide-react";
import Link from "next/link";
import { requireStudio } from "@/lib/auth";
import { formatCount, formatDate } from "@/lib/format";
import { presignGet } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const studio = await requireStudio();
  const sb = await supabaseServer();
  const { data: events } = await sb
    .from("events")
    .select("*")
    .eq("studio_id", studio.id)
    .neq("status", "deleting")
    .order("created_at", { ascending: false });
  const list = events ?? [];
  const covers = await Promise.all(
    list.map(async (e) => {
      if (e.cover_key) return presignGet(e.cover_key);
      const { data } = await sb
        .from("photos")
        .select("r2_key_thumb")
        .eq("event_id", e.id)
        .eq("status", "done")
        .not("r2_key_thumb", "is", null)
        .order("taken_at", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data?.r2_key_thumb ? presignGet(data.r2_key_thumb) : null;
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-12">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <p className="eyebrow">{studio.name}</p>
          <h1 className="font-display text-display-md">Events</h1>
        </div>
        {list.length ? (
          <Button asChild>
            <Link href="/app/events/new">
              <Plus /> New event
            </Link>
          </Button>
        ) : null}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Images />}
          title="Your first event starts here"
          description="Create an event, drop in the photos, and share one QR code with every guest."
          action={
            <Button asChild>
              <Link href="/app/events/new">
                <Plus /> Create an event
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e, i) => {
            const pct = e.photo_count ? Math.round((e.processed_count / e.photo_count) * 100) : 0;
            const processing = e.photo_count > 0 && e.processed_count < e.photo_count;
            return (
              <li key={e.id}>
                <Link
                  href={`/app/events/${e.id}`}
                  className="group grid overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong"
                >
                  <div className="vignette relative aspect-[16/10] overflow-hidden bg-raised">
                    {covers[i] ? (
                      <img src={covers[i]!} alt="" className="size-full object-cover transition-transform duration-700 ease-out-quint group-hover:scale-[1.03]" />
                    ) : (
                      <img src="/marketing/frame-3.webp" alt="" className="size-full object-cover opacity-40" />
                    )}
                    <div className="absolute left-3 top-3 z-[2] flex gap-2">
                      {processing ? (
                        <Badge tone="amber" dot>
                          Processing {pct}%
                        </Badge>
                      ) : e.photo_count ? (
                        <Badge tone="success" dot>
                          Live
                        </Badge>
                      ) : (
                        <Badge>Empty</Badge>
                      )}
                      {e.visibility === "pin" ? <Badge>PIN</Badge> : null}
                    </div>
                  </div>
                  <div className="grid gap-2 p-4">
                    <h2 className="truncate font-display text-2xl leading-tight">{e.name}</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
                      {e.event_date ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" aria-hidden />
                          {formatDate(e.event_date)}
                        </span>
                      ) : null}
                      <span>{formatCount(e.photo_count)} photos</span>
                      <span>{formatCount(e.people_count)} people</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
