"use client";

import { Button, DevelopImage, PhotoGrid, type GridPhoto } from "@glimpse/ui";
import { ChevronLeft, ChevronRight, Download, FileArchive, Share2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { GuestPhoto } from "./gallery-data";

export function Gallery({
  slug,
  eventName,
  photos,
  allowDownload,
  showZip,
}: {
  slug: string;
  eventName: string;
  photos: GuestPhoto[];
  allowDownload: boolean;
  showZip: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const grid: GridPhoto[] = photos.map((p, i) => ({
    id: p.id,
    src: p.thumb,
    width: p.width,
    height: p.height,
    blurhash: p.blurhash,
    alt: `Photo ${i + 1} of ${photos.length} from ${eventName}`,
  }));
  const go = useCallback((d: number) => setOpen((o) => (o === null ? o : (o + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, go]);

  async function share() {
    const url = `${window.location.origin}/e/${slug}`;
    if (navigator.share) await navigator.share({ title: eventName, text: `Photos from ${eventName} — find yours with a selfie`, url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url);
  }

  const current = open === null ? null : photos[open];
  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {allowDownload && showZip ? (
          <Button asChild>
            <a href={`/api/e/${slug}/zip`} download>
              <FileArchive /> Download all
            </a>
          </Button>
        ) : null}
        <Button variant="secondary" onClick={share}>
          <Share2 /> Share event
        </Button>
      </div>
      <PhotoGrid photos={grid} onOpen={setOpen} targetRowHeight={280} gap={6} />

      <AnimatePresence>
        {current ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${open! + 1} of ${photos.length}`}
            className="fixed inset-0 z-50 flex flex-col bg-ink/97"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <p className="px-2 font-mono text-xs text-muted tabular">
                {open! + 1} / {photos.length}
              </p>
              <div className="flex items-center gap-1">
                {allowDownload ? (
                  <a
                    href={`/api/e/${slug}/download/${current.id}`}
                    className="grid size-11 place-items-center rounded-md text-paper hover:bg-raised"
                    aria-label="Download this photo"
                  >
                    <Download className="size-5" />
                  </a>
                ) : null}
                <button type="button" onClick={() => setOpen(null)} className="grid size-11 place-items-center rounded-md text-paper hover:bg-raised" aria-label="Close" autoFocus>
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <motion.div
              key={current.id}
              className="relative flex min-h-0 flex-1 items-center justify-center p-2 sm:p-6"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) go(1);
                else if (info.offset.x > 60) go(-1);
              }}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
            >
              <DevelopImage
                src={current.web}
                alt={`Photo ${open! + 1} of ${photos.length}`}
                blurhash={current.blurhash}
                priority
                className="max-h-full bg-transparent"
                imgClassName="max-h-[calc(100dvh-7rem)] w-auto object-contain"
              />
            </motion.div>
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-4 sm:flex">
              <button type="button" onClick={() => go(-1)} className="pointer-events-auto grid size-12 place-items-center rounded-full bg-raised/70 text-paper hover:bg-raised" aria-label="Previous photo">
                <ChevronLeft className="size-5" />
              </button>
              <button type="button" onClick={() => go(1)} className="pointer-events-auto grid size-12 place-items-center rounded-full bg-raised/70 text-paper hover:bg-raised" aria-label="Next photo">
                <ChevronRight className="size-5" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
