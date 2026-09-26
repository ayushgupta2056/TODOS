"use client";

import { ProgressRing } from "@glimpse/ui";
import { useEffect, useState } from "react";
import { formatCount } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";

export interface Stats {
  photo_count: number;
  processed_count: number;
  failed_count: number;
  face_count: number;
  people_count: number;
}

export const STATS_EVENT = "glimpse:stats";

/** Live counters via Supabase Realtime (RLS-scoped), with a slow poll as a safety net. */
export function ProcessingPanel({ eventId, initial }: { eventId: string; initial: Stats }) {
  const [s, setS] = useState<Stats>(initial);

  useEffect(() => {
    const sb = supabaseBrowser();
    const apply = (row: Partial<Stats>) => {
      setS((prev) => {
        const next = { ...prev, ...row } as Stats;
        window.dispatchEvent(new CustomEvent(STATS_EVENT, { detail: next }));
        return next;
      });
    };
    const channel = sb
      .channel(`event-${eventId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` }, (p) =>
        apply(p.new as Partial<Stats>),
      )
      .subscribe();
    const poll = setInterval(async () => {
      const { data } = await sb
        .from("events")
        .select("photo_count, processed_count, failed_count, face_count, people_count")
        .eq("id", eventId)
        .maybeSingle();
      if (data) apply(data);
    }, 10_000);
    return () => {
      clearInterval(poll);
      void sb.removeChannel(channel);
    };
  }, [eventId]);

  const pct = s.photo_count ? (s.processed_count / s.photo_count) * 100 : 0;
  const busy = s.photo_count > 0 && s.processed_count < s.photo_count;
  return (
    <aside aria-label="Processing" className="grid h-fit gap-6 rounded-lg border border-line bg-surface p-6 xl:sticky xl:top-6">
      <div className="flex items-center gap-5">
        <ProgressRing value={pct} size={104} label="Photos processed">
          <span className="font-mono text-lg tabular">{Math.round(pct)}%</span>
        </ProgressRing>
        <div className="grid gap-1">
          <p className="font-medium">{busy ? "Finding faces…" : s.photo_count ? "All processed" : "Waiting for photos"}</p>
          <p className="text-sm text-muted" aria-live="polite">
            {busy
              ? `${formatCount(s.photo_count - s.processed_count)} to go`
              : s.photo_count
                ? "Guests can search now."
                : "Drop photos to begin."}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
        {[
          ["Uploaded", s.photo_count],
          ["Processed", s.processed_count],
          ["Faces found", s.face_count],
          ["People", s.people_count],
        ].map(([label, v]) => (
          <div key={label} className="grid gap-1 bg-surface p-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-mono text-xl tabular">{formatCount(Number(v))}</dd>
          </div>
        ))}
      </dl>
      {s.failed_count ? (
        <p className="text-sm text-red">
          {formatCount(s.failed_count)} file{s.failed_count === 1 ? "" : "s"} couldn&rsquo;t be read. They&rsquo;re marked in the grid.
        </p>
      ) : null}
    </aside>
  );
}
