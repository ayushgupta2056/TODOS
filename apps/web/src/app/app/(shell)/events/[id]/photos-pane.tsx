"use client";

import { Badge, Button, Dialog, DialogContent, EmptyState, PhotoGrid, type GridPhoto } from "@glimpse/ui";
import { ImageOff, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCount } from "@/lib/format";
import { deletePhoto } from "../../../actions";
import { STATS_EVENT } from "./processing-panel";

interface StudioPhoto {
  id: string;
  name: string;
  width: number;
  height: number;
  blurhash: string | null;
  status: string;
  faces: number;
  error: string | null;
  thumb: string | null;
  web: string | null;
}

const PAGE = 120;

export function PhotosPane({ eventId }: { eventId: string }) {
  const [photos, setPhotos] = useState<StudioPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<StudioPhoto | null>(null);
  const lastRefresh = useRef(0);

  const load = useCallback(
    async (offset: number) => {
      const res = await fetch(`/api/events/${eventId}/photos?offset=${offset}&limit=${PAGE}`, { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { photos: StudioPhoto[]; total: number };
      setTotal(body.total);
      setPhotos((prev) => (offset === 0 ? body.photos : [...prev, ...body.photos]));
      setLoading(false);
    },
    [eventId],
  );

  useEffect(() => {
    void load(0);
    const onStats = () => {
      const now = Date.now();
      if (now - lastRefresh.current < 4000) return;
      lastRefresh.current = now;
      void load(0);
    };
    window.addEventListener(STATS_EVENT, onStats);
    return () => window.removeEventListener(STATS_EVENT, onStats);
  }, [load]);

  const grid: GridPhoto[] = photos.map((p) => ({
    id: p.id,
    src: p.thumb ?? "/marketing/frame-3.webp",
    width: p.width,
    height: p.height,
    blurhash: p.blurhash,
    alt: p.name,
  }));

  if (loading) return <div className="skeleton h-72 rounded-lg" aria-label="Loading photos" />;
  if (!photos.length) {
    return (
      <EmptyState
        icon={<ImageOff />}
        title="No photos yet"
        description="Drop a folder above. Faces are found automatically as each photo lands."
      />
    );
  }
  return (
    <section aria-label="Photos" className="grid gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl">Photos</h2>
        <p className="font-mono text-xs text-muted">
          {formatCount(photos.length)} of {formatCount(total)}
        </p>
      </div>
      <PhotoGrid
        photos={grid}
        targetRowHeight={180}
        gap={6}
        onOpen={(i) => setOpen(photos[i] ?? null)}
        renderOverlay={(_, i) => {
          const p = photos[i];
          if (!p || p.status === "done") return null;
          return (
            <span className="pointer-events-none absolute left-1.5 top-1.5">
              {p.status === "failed" ? (
                <Badge tone="danger">Unreadable</Badge>
              ) : p.status === "no_faces" ? (
                <Badge>No faces</Badge>
              ) : (
                <Badge tone="amber" dot>
                  Processing
                </Badge>
              )}
            </span>
          );
        }}
      />
      {photos.length < total ? (
        <Button variant="secondary" className="justify-self-center" onClick={() => void load(photos.length)}>
          Show more
        </Button>
      ) : null}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {open ? (
          <DialogContent
            title={open.name}
            description={open.status === "failed" ? open.error ?? "This file couldn't be read." : `${open.faces} face${open.faces === 1 ? "" : "s"} found`}
            className="max-w-3xl"
          >
            {open.web ? <img src={open.web} alt={open.name} className="max-h-[60dvh] w-full rounded-md object-contain" /> : null}
            <form
              action={async (fd) => {
                await deletePhoto(fd);
                setOpen(null);
                void load(0);
              }}
              className="mt-5 flex justify-end"
            >
              <input type="hidden" name="photo_id" value={open.id} />
              <input type="hidden" name="event_id" value={eventId} />
              <Button type="submit" variant="ghost" className="text-red hover:text-red">
                <Trash2 /> Delete photo
              </Button>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
