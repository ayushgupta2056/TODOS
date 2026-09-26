"use client";

import { Button, Progress, cn, toast } from "@glimpse/ui";
import AwsS3 from "@uppy/aws-s3";
import Uppy from "@uppy/core";
import { FolderUp, ImageUp, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatBytes, formatCount } from "@/lib/format";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/tiff"];
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/tiff": "tiff" };
const MAX_BYTES = 200 * 1024 * 1024;

type Meta = { sha256: string; objectKey: string; contentType: string };
type Phase = "idle" | "hashing" | "uploading" | "done" | "blocked";

interface Tally {
  total: number;
  hashed: number;
  uploaded: number;
  registered: number;
  duplicates: number;
  skipped: number;
  failed: number;
  bytes: number;
}
const EMPTY: Tally = { total: 0, hashed: 0, uploaded: 0, registered: 0, duplicates: 0, skipped: 0, failed: 0, bytes: 0 };

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sniffType(file: File): string | null {
  if (ACCEPT.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  return null;
}

/** Walk dropped folders (Chrome/Edge/Safari/Firefox all support webkitGetAsEntry). */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry()).filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return [...dt.files];
  for (const e of entries) await walk(e);
  return out;
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++]!;
        await fn(item);
      }
    }),
  );
}

export function Uploader({ eventId, token }: { eventId: string; token: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [tally, setTally] = useState<Tally>(EMPTY);
  const [progress, setProgress] = useState(0);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const uppyRef = useRef<Uppy<Meta, Record<string, never>> | null>(null);
  const queue = useRef<{ key: string; name: string; type: string; size: number; sha256: string }[]>([]);
  const flushing = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const bump = (patch: Partial<Record<keyof Tally, number>>) =>
    setTally((t) => {
      const next = { ...t };
      for (const [k, v] of Object.entries(patch)) next[k as keyof Tally] += v ?? 0;
      return next;
    });

  async function flush(force = false) {
    if (flushing.current) return;
    if (!force && queue.current.length < 25) return;
    flushing.current = true;
    try {
      while (queue.current.length) {
        const batch = queue.current.splice(0, 50);
        const res = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, files: batch }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 402) {
            setBlocked(body.error ?? "Plan limit reached.");
            setPhase("blocked");
            uppyRef.current?.cancelAll();
          }
          bump({ failed: batch.length });
          continue;
        }
        const { results } = (await res.json()) as { results: { created: boolean; error?: string }[] };
        bump({
          registered: results.filter((r) => r.created).length,
          duplicates: results.filter((r) => !r.created && !r.error).length,
          failed: results.filter((r) => r.error).length,
        });
      }
    } finally {
      flushing.current = false;
    }
  }

  useEffect(() => {
    const uppy = new Uppy<Meta, Record<string, never>>({
      autoProceed: false,
      restrictions: { maxFileSize: MAX_BYTES },
    }).use(AwsS3<Meta, Record<string, never>>, {
      limit: 6,
      allowedMetaFields: false, // metadata headers would be unsigned on presigned URLs
      shouldUseMultipart: (file) => (file.size ?? 0) > 20 * 1024 * 1024,
      getChunkSize: () => 8 * 1024 * 1024,
      generateObjectKey: (file) => file.meta.objectKey,
      signRequest: async (request) => {
        const res = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, request }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "sign failed" }))).error);
        return (await res.json()) as { url: string };
      },
    });
    uppy.on("progress", (p) => setProgress(p));
    uppy.on("upload-success", (file) => {
      if (!file) return;
      bump({ uploaded: 1 });
      queue.current.push({
        key: file.meta.objectKey,
        name: file.name ?? "photo",
        type: file.meta.contentType,
        size: file.size ?? 0,
        sha256: file.meta.sha256,
      });
      void flush();
    });
    uppy.on("upload-error", () => bump({ failed: 1 }));
    uppy.on("complete", async () => {
      await flush(true);
      setPhase((p) => (p === "blocked" ? p : "done"));
    });
    uppyRef.current = uppy;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (uppy.getFiles().some((f) => !f.progress.uploadComplete)) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      uppy.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function start(raw: File[]) {
    const uppy = uppyRef.current;
    if (!uppy || phase === "hashing" || phase === "uploading") return;
    const images = raw
      .map((f) => ({ f, type: sniffType(f) }))
      .filter((x): x is { f: File; type: string } => !!x.type && x.f.size > 0 && x.f.size <= MAX_BYTES && !x.f.name.startsWith("."));
    const skipped = raw.length - images.length;
    if (!images.length) {
      toast.error("No photos found", "Drop JPEG, PNG, WebP or TIFF files, or a folder of them.");
      return;
    }
    uppy.clear();
    setBlocked(null);
    setProgress(0);
    setTally({ ...EMPTY, total: images.length, skipped, bytes: images.reduce((a, x) => a + x.f.size, 0) });
    setPhase("hashing");

    const hashed: { f: File; type: string; sha: string }[] = [];
    await pool(images, 4, async ({ f, type }) => {
      hashed.push({ f, type, sha: await sha256(f) });
      bump({ hashed: 1 });
    });

    const seen = new Set<string>();
    const unique = hashed.filter((h) => (seen.has(h.sha) ? false : (seen.add(h.sha), true)));
    const res = await fetch("/api/uploads/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, files: unique.map((u) => ({ sha256: u.sha, size: u.f.size })) }),
    });
    if (!res.ok) {
      setPhase("idle");
      toast.error("Couldn't start the upload", "Reload the page and try again.");
      return;
    }
    const check = (await res.json()) as { existing: string[]; allowed: boolean; reason: string | null };
    if (!check.allowed) {
      setBlocked(check.reason);
      setPhase("blocked");
      return;
    }
    const existing = new Set(check.existing);
    const fresh = unique.filter((u) => !existing.has(u.sha));
    bump({ duplicates: hashed.length - fresh.length });
    if (!fresh.length) {
      setPhase("done");
      return;
    }
    uppy.addFiles(
      fresh.map((u) => ({
        name: u.f.name,
        type: u.type,
        data: u.f,
        meta: { sha256: u.sha, contentType: u.type, objectKey: `events/${eventId}/original/${crypto.randomUUID()}.${EXT[u.type]}` },
      })),
    );
    setPhase("uploading");
    await uppy.upload();
  }

  const busy = phase === "hashing" || phase === "uploading";
  const pct = phase === "hashing" ? (tally.hashed / Math.max(1, tally.total)) * 100 : progress;

  return (
    <section aria-label="Upload photos" className="grid gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) await start(await filesFromDrop(e.dataTransfer));
        }}
        className={cn(
          "relative grid place-items-center gap-5 overflow-hidden rounded-lg border border-dashed px-6 py-12 text-center transition-colors",
          dragging ? "border-amber bg-amber-soft" : "border-line-strong bg-surface/50",
        )}
      >
        {busy ? (
          <div className="grid w-full max-w-md gap-4" aria-live="polite">
            <p className="font-display text-3xl">{phase === "hashing" ? "Checking for duplicates…" : "Uploading…"}</p>
            <Progress value={pct} label={phase === "hashing" ? "Checking files" : "Upload progress"} />
            <p className="font-mono text-xs text-muted tabular">
              {phase === "hashing"
                ? `${formatCount(tally.hashed)} / ${formatCount(tally.total)} files`
                : `${formatCount(tally.uploaded)} / ${formatCount(tally.total - tally.duplicates)} uploaded · ${formatBytes(tally.bytes)}`}
            </p>
            <Button variant="ghost" size="sm" className="justify-self-center" onClick={() => { uppyRef.current?.cancelAll(); setPhase("idle"); }}>
              <X /> Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              <p className="font-display text-3xl">Drop the whole shoot here</p>
              <p className="text-sm text-muted">Folders welcome. JPEG, PNG, WebP or TIFF, up to 200 MB each. Duplicates are skipped.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => folderInput.current?.click()}>
                <FolderUp /> Choose folder
              </Button>
              <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                <ImageUp /> Choose photos
              </Button>
            </div>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void start([...(e.target.files ?? [])]).finally(() => (e.target.value = ""))}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          // @ts-expect-error non-standard but universally supported folder picker
          webkitdirectory=""
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void start([...(e.target.files ?? [])]).finally(() => (e.target.value = ""))}
        />
      </div>

      {phase === "blocked" && blocked ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber/40 bg-amber-soft p-4 text-sm">
          <span>{blocked}</span>
          <Button asChild size="sm" variant="secondary">
            <a href="/app/billing">See plans</a>
          </Button>
        </div>
      ) : null}

      {phase === "done" || (phase === "blocked" && tally.uploaded > 0) ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-4 text-sm">
          <span>
            <span className="text-paper">{formatCount(tally.registered)} added</span>
            {tally.duplicates ? <span className="text-muted"> · {formatCount(tally.duplicates)} already here</span> : null}
            {tally.skipped ? <span className="text-muted"> · {formatCount(tally.skipped)} not photos</span> : null}
            {tally.failed ? <span className="text-red"> · {formatCount(tally.failed)} failed</span> : null}
          </span>
          {tally.failed ? (
            <Button size="sm" variant="secondary" onClick={() => { setPhase("uploading"); void uppyRef.current?.retryAll(); }}>
              <RotateCcw /> Retry failed
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
