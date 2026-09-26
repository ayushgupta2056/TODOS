"use client";

import { decode } from "blurhash";
import * as React from "react";
import { cn } from "../cn";

export interface GridPhoto {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  blurhash?: string | null | undefined;
}

const hashCache = new Map<string, string>();

function blurhashToDataUrl(hash: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const cached = hashCache.get(hash);
  if (cached) return cached;
  try {
    const w = 32;
    const h = 32;
    const pixels = decode(hash, w, h);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const img = ctx.createImageData(w, h);
    img.data.set(pixels);
    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL();
    hashCache.set(hash, url);
    return url;
  } catch {
    return undefined;
  }
}

/** An image that "develops" like a print: blur -> sharp, 400ms, once it has loaded. */
export function DevelopImage({
  src,
  alt,
  blurhash,
  className,
  imgClassName,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  blurhash?: string | null | undefined;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [placeholder, setPlaceholder] = React.useState<string | undefined>(undefined);
  const ref = React.useRef<HTMLImageElement>(null);
  React.useEffect(() => {
    if (blurhash) setPlaceholder(blurhashToDataUrl(blurhash));
  }, [blurhash]);
  React.useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <div
      className={cn("relative overflow-hidden bg-raised", className)}
      style={
        placeholder
          ? { backgroundImage: `url(${placeholder})`, backgroundSize: "cover" }
          : undefined
      }
    >
      <img
        ref={ref}
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "size-full object-cover",
          loaded ? "animate-develop" : "opacity-0",
          imgClassName,
        )}
      />
    </div>
  );
}

interface Row {
  items: { photo: GridPhoto; index: number; w: number }[];
  h: number;
}

export function justify(photos: GridPhoto[], width: number, target: number, gap: number): Row[] {
  const rows: Row[] = [];
  let current: { photo: GridPhoto; index: number }[] = [];
  let ratioSum = 0;
  photos.forEach((photo, index) => {
    const ratio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
    current.push({ photo, index });
    ratioSum += ratio;
    const rowW = ratioSum * target + gap * (current.length - 1);
    if (rowW >= width) {
      const h = (width - gap * (current.length - 1)) / ratioSum;
      rows.push({
        h,
        items: current.map((c) => ({
          ...c,
          w: h * (c.photo.width > 0 && c.photo.height > 0 ? c.photo.width / c.photo.height : 1.5),
        })),
      });
      current = [];
      ratioSum = 0;
    }
  });
  if (current.length) {
    const h = Math.min(target, (width - gap * (current.length - 1)) / ratioSum);
    rows.push({
      h,
      items: current.map((c) => ({
        ...c,
        w: h * (c.photo.width > 0 && c.photo.height > 0 ? c.photo.width / c.photo.height : 1.5),
      })),
    });
  }
  return rows;
}

/** Justified photo grid. Photos are the hero: no chrome, generous gutters. */
export function PhotoGrid({
  photos,
  onOpen,
  targetRowHeight = 260,
  gap = 8,
  className,
  renderOverlay,
}: {
  photos: GridPhoto[];
  onOpen?: (index: number) => void;
  targetRowHeight?: number;
  gap?: number;
  className?: string;
  renderOverlay?: (photo: GridPhoto, index: number) => React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const target = width && width < 640 ? Math.max(140, targetRowHeight * 0.62) : targetRowHeight;
  const rows = width ? justify(photos, width, target, gap) : [];
  return (
    <div ref={ref} className={cn("w-full", className)} role="list">
      {rows.map((row, r) => (
        <div key={r} className="flex" style={{ gap, marginBottom: gap, height: row.h }}>
          {row.items.map(({ photo, index, w }) => (
            <div key={photo.id} role="listitem" className="group relative shrink-0" style={{ width: w, height: row.h }}>
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(index)}
                  className="block size-full overflow-hidden rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
                  aria-label={`Open ${photo.alt}`}
                >
                  <DevelopImage
                    src={photo.src}
                    alt={photo.alt}
                    blurhash={photo.blurhash}
                    className="size-full rounded-sm"
                    imgClassName="transition-transform duration-500 ease-out-quint group-hover:scale-[1.015]"
                  />
                </button>
              ) : (
                <DevelopImage src={photo.src} alt={photo.alt} blurhash={photo.blurhash} className="size-full rounded-sm" />
              )}
              {renderOverlay ? renderOverlay(photo, index) : null}
            </div>
          ))}
        </div>
      ))}
      {!width ? <div className="skeleton h-64 rounded-sm" aria-hidden /> : null}
    </div>
  );
}
