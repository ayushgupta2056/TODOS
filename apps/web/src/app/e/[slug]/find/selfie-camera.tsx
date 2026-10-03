"use client";

import { Button, cn } from "@glimpse/ui";
import { ArrowRight, Camera, ImageUp, RotateCcw } from "lucide-react";
import { animate, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { assessFrame, HINT_COPY, type Box, type Hint } from "@/lib/selfie-quality";

type Phase = "intro" | "starting" | "live" | "matching" | "found" | "none" | "error";

const ERROR_COPY: Record<string, string> = {
  no_face: "We couldn't see a face. Face the camera in good light and try again.",
  multiple_faces: "We saw more than one face. Make sure it's just you.",
  too_small: "Move a little closer so your face fills the oval.",
  too_blurry: "The photo came out blurry. Hold still for a second.",
  bad_image: "We couldn't read that image. Try again.",
  rate_limited: "Lots of searches just now. Wait a minute and try again.",
  consent: "Please confirm consent first.",
  unavailable: "The matcher is still starting up. Try again in a moment.",
};

interface Detector {
  detectForVideo: (v: HTMLVideoElement, t: number) => { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number } }[] };
  close: () => void;
}

async function loadDetector(): Promise<Detector | null> {
  try {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    return (await FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite", delegate: "GPU" },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.6,
    })) as unknown as Detector;
  } catch {
    return null; // hints are a nicety; capture still works without them
  }
}

function Counter({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = String(to);
      return;
    }
    const c = animate(0, to, {
      duration: Math.min(1.6, 0.6 + to / 120),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = String(Math.round(v))),
    });
    return () => c.stop();
  }, [to, reduce]);
  return <span ref={ref}>0</span>;
}

export function SelfieCamera({ slug, eventName }: { slug: string; eventName: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [hint, setHint] = useState<Hint>("no_face");
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const rafRef = useRef<number>(0);
  const prevBox = useRef<Box | null>(null);
  const lumaCanvas = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopCamera();
      detectorRef.current?.close();
    },
    [stopCamera],
  );

  const loop = useCallback(() => {
    const v = videoRef.current;
    const det = detectorRef.current;
    if (!v || v.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    let last = 0;
    const tick = (t: number) => {
      if (!streamRef.current) return;
      if (t - last > 120) {
        last = t;
        const c = (lumaCanvas.current ??= document.createElement("canvas"));
        c.width = 24;
        c.height = 24;
        const g = c.getContext("2d", { willReadFrequently: true });
        let brightness = 128;
        if (g) {
          g.drawImage(v, 0, 0, 24, 24);
          const d = g.getImageData(0, 0, 24, 24).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
          brightness = sum / (d.length / 4);
        }
        if (det) {
          try {
            const res = det.detectForVideo(v, t);
            const faces = res.detections
              .map((d) => d.boundingBox)
              .filter((b): b is NonNullable<typeof b> => !!b)
              .map((b) => ({ x: b.originX, y: b.originY, w: b.width, h: b.height }));
            const a = assessFrame({ faces, frameW: v.videoWidth, frameH: v.videoHeight, brightness, previous: prevBox.current });
            prevBox.current = a.face;
            setHint(a.hint);
          } catch {
            setHint("ok");
          }
        } else {
          setHint(brightness < 50 ? "light" : "ok");
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  async function startCamera() {
    setError(null);
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      setPhase("live");
      detectorRef.current ??= await loadDetector();
      loop();
    } catch {
      setPhase("error");
      setError("We couldn't open your camera. Allow camera access in your browser settings, or upload a selfie instead.");
    }
  }

  async function search(blob: Blob) {
    setPhase("matching");
    setSlow(false);
    // A sleeping free-tier worker takes a while to wake: say so instead of looking stuck.
    const slowTimer = setTimeout(() => setSlow(true), 8000);
    try {
      const res = await fetch(`/api/e/${slug}/search`, { method: "POST", body: blob, headers: { "content-type": blob.type || "image/jpeg" } });
      const body = (await res.json().catch(() => ({}))) as { count?: number; code?: string };
      if (!res.ok) {
        setPhase("error");
        setError(ERROR_COPY[body.code ?? ""] ?? "Something went wrong. Try again.");
        return;
      }
      setCount(body.count ?? 0);
      setPhase((body.count ?? 0) > 0 ? "found" : "none");
    } catch {
      setPhase("error");
      setError("You seem to be offline. Check your connection and try again.");
    } finally {
      clearTimeout(slowTimer);
      setFrozen((f) => {
        if (f) URL.revokeObjectURL(f);
        return null;
      });
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    stopCamera(); // camera off the moment we have the frame
    c.toBlob(
      (blob) => {
        c.width = 0; // drop the pixels
        if (!blob) return;
        setFrozen(URL.createObjectURL(blob));
        void search(blob);
      },
      "image/jpeg",
      0.9,
    );
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    stopCamera();
    setFrozen(URL.createObjectURL(f));
    void search(f);
  }

  const ready = hint === "ok";
  const showCamera = phase === "starting" || phase === "live" || phase === "matching";

  return (
    <div data-theme="dark" className="fixed inset-0 flex flex-col bg-ink text-paper">
      {/* Viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-hidden
          className={cn("absolute inset-0 size-full -scale-x-100 object-cover transition-opacity duration-500", showCamera && !frozen ? "opacity-100" : "opacity-0")}
        />
        {frozen ? <img src={frozen} alt="" aria-hidden className="absolute inset-0 size-full -scale-x-100 object-cover" /> : null}

        {/* Oval mask + guide */}
        {showCamera ? (
          <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            <defs>
              <mask id="oval">
                <rect width="100%" height="100%" fill="white" />
                <ellipse cx="50%" cy="44%" rx="min(34vw, 150px)" ry="min(45vw, 200px)" fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgb(14 12 10 / 0.72)" mask="url(#oval)" />
            <ellipse
              cx="50%"
              cy="44%"
              rx="min(34vw, 150px)"
              ry="min(45vw, 200px)"
              fill="none"
              strokeWidth="2.5"
              className={cn("transition-[stroke] duration-300", ready || phase === "matching" ? "stroke-[var(--amber)]" : "stroke-[rgb(243_237_228/0.7)]")}
            />
          </svg>
        ) : null}

        {phase === "matching" ? (
          <div
            className="pointer-events-none absolute left-1/2 top-[44%] h-[min(90vw,400px)] w-[min(68vw,300px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[50%]"
            aria-hidden
          >
            <div className="absolute inset-x-0 top-0 h-[10%] animate-scan bg-gradient-to-b from-transparent via-[var(--amber)] to-transparent opacity-80 blur-[2px]" />
          </div>
        ) : null}

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link href={`/e/${slug}`} className="rounded-md px-2 py-2.5 text-sm text-paper/80 hover:text-paper">
            ← Back
          </Link>
          <p className="max-w-[60%] truncate text-sm text-paper/70">{eventName}</p>
        </div>

        {/* Intro */}
        {phase === "intro" ? (
          <div className="absolute inset-0 grid place-items-center px-6">
            <div className="grid max-w-sm justify-items-center gap-6 text-center">
              <div className="grid size-40 place-items-center rounded-[50%] border-2 border-dashed border-paper/40">
                <Camera className="size-8 text-paper/70" aria-hidden />
              </div>
              <div className="grid gap-2">
                <h1 className="font-display text-4xl leading-tight">Take a quick selfie</h1>
                <p className="text-muted">Good light, face straight on, just you. It&rsquo;s used once and never saved.</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Results */}
        {phase === "found" ? (
          <motion.div
            className="absolute inset-0 grid place-items-center bg-ink px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="grid justify-items-center gap-6 text-center">
              <p className="eyebrow">Found you</p>
              <h1 className="font-display text-5xl leading-none" aria-live="polite">
                You&rsquo;re in
                <span className="my-2 block text-[7rem] italic leading-none text-accent tabular">
                  <Counter to={count} />
                </span>
                photo{count === 1 ? "" : "s"}
              </h1>
            </div>
          </motion.div>
        ) : null}

        {phase === "none" || phase === "error" ? (
          <div className="absolute inset-0 grid place-items-center bg-ink px-6">
            <div className="grid max-w-sm justify-items-center gap-4 text-center" role="alert">
              <h1 className="font-display text-4xl leading-tight">{phase === "none" ? "No photos of you yet" : "Let's try that again"}</h1>
              <p className="text-muted">
                {phase === "none"
                  ? "We didn't find you in this event's photos. If the photographer is still uploading, check back later — or try a selfie in better light."
                  : error}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Controls */}
      <div className="grid gap-4 border-t border-line bg-ink px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {phase === "live" || phase === "starting" ? (
          <>
            <p className={cn("text-center text-base transition-colors", ready ? "text-accent" : "text-paper")} aria-live="polite">
              {phase === "starting" ? "Opening camera…" : HINT_COPY[hint]}
            </p>
            <div className="flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid size-12 place-items-center rounded-full text-muted hover:text-paper"
                aria-label="Upload a selfie instead"
              >
                <ImageUp className="size-5" />
              </button>
              <button
                type="button"
                onClick={capture}
                disabled={phase !== "live"}
                aria-label="Take selfie"
                className={cn(
                  "grid size-[76px] place-items-center rounded-full border-[3px] transition-all duration-200 active:scale-95 disabled:opacity-40",
                  ready ? "border-[var(--amber)]" : "border-paper/70",
                )}
              >
                <span className={cn("size-[60px] rounded-full transition-colors", ready ? "bg-[var(--amber)]" : "bg-paper/90")} />
              </button>
              <span className="size-12" aria-hidden />
            </div>
          </>
        ) : null}
        {phase === "intro" ? (
          <>
            <Button size="xl" onClick={startCamera}>
              <Camera /> Open camera
            </Button>
            <Button size="lg" variant="ghost" onClick={() => fileRef.current?.click()}>
              <ImageUp /> Upload a selfie instead
            </Button>
          </>
        ) : null}
        {phase === "matching" ? (
          <p className="py-6 text-center text-paper" aria-live="polite">
            {slow ? "Waking up the matcher. The first search can take up to a minute…" : "Looking through the photos…"}
          </p>
        ) : null}
        {phase === "found" ? (
          <Button asChild size="xl">
            <Link href={`/e/${slug}/me`}>
              See your photos <ArrowRight />
            </Link>
          </Button>
        ) : null}
        {phase === "none" || phase === "error" ? (
          <>
            <Button size="xl" onClick={startCamera}>
              <RotateCcw /> Try again
            </Button>
            <Button size="lg" variant="ghost" onClick={() => fileRef.current?.click()}>
              <ImageUp /> Upload a selfie instead
            </Button>
          </>
        ) : null}
        <input ref={fileRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      </div>
    </div>
  );
}
