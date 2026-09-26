"use client";

import { cn } from "@glimpse/ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const FRAMES = [1, 2, 3, 5, 6, 7, 8, 2, 4].map((n) => `/marketing/frame-${n}.webp`);
const MATCHED = new Set([1, 5, 6]);

/** A quiet, looping demo: contact sheet -> selfie scan -> only "your" frames stay lit. */
export function HeroDemo() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"sheet" | "scan" | "found">(reduce ? "found" : "sheet");
  useEffect(() => {
    if (reduce) return;
    const seq: ["sheet" | "scan" | "found", number][] = [
      ["scan", 1800],
      ["found", 4200],
      ["sheet", 3600],
    ];
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const [next, wait] = seq[i % seq.length]!;
      timer = setTimeout(() => {
        setPhase(next);
        i++;
        step();
      }, wait);
    };
    step();
    return () => clearTimeout(timer);
  }, [reduce]);

  return (
    <div className="relative mx-auto w-full max-w-[640px] pr-[26%]" aria-hidden>
      <div className="grain vignette grid grid-cols-3 gap-2 overflow-hidden rounded-lg border border-line bg-surface p-2 sm:gap-2.5 sm:p-2.5">
        {FRAMES.map((src, i) => {
          const lit = phase !== "found" || MATCHED.has(i);
          return (
            <motion.div
              key={`${src}-${i}`}
              className="relative aspect-[4/5] overflow-hidden rounded-sm bg-raised"
              animate={{ opacity: lit ? 1 : 0.18, filter: lit ? "grayscale(0)" : "grayscale(1)" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: phase === "found" ? i * 0.04 : 0 }}
            >
              <img src={src} alt="" className="size-full object-cover" loading="eager" />
              <span className="absolute bottom-1 left-1.5 font-mono text-[0.6rem] text-paper/60">
                {String(i + 1).padStart(2, "0")}A
              </span>
              {phase === "found" && MATCHED.has(i) ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05, type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 rounded-sm ring-2 ring-inset ring-amber"
                />
              ) : null}
            </motion.div>
          );
        })}
      </div>

      {/* Phone */}
      <div className="absolute right-0 top-1/2 w-[36%] min-w-[128px] -translate-y-1/2">
        <div className="rounded-[1.8rem] border border-line-strong bg-ink p-1.5 shadow-2xl shadow-black/60">
          <div className="relative aspect-[9/17] overflow-hidden rounded-[1.4rem] bg-surface">
            <img src="/marketing/frame-4.webp" alt="" className="absolute inset-0 size-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-transparent to-ink/80" />
            <div className="absolute left-1/2 top-[38%] aspect-[3/4] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-paper/70">
              {phase === "scan" ? (
                <div className="absolute inset-x-0 top-0 h-[9%] animate-scan rounded-full bg-gradient-to-b from-transparent via-amber/80 to-transparent blur-[1px]" />
              ) : null}
            </div>
            <div className="absolute inset-x-0 bottom-0 grid gap-1 p-3 text-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phase}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className={cn("text-[0.7rem] leading-tight text-paper/90", phase === "found" && "text-paper")}
                >
                  {phase === "sheet" && "Look at the camera"}
                  {phase === "scan" && "Finding you…"}
                  {phase === "found" && (
                    <>
                      You&rsquo;re in <span className="font-display text-lg italic text-amber">3</span> photos
                    </>
                  )}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
