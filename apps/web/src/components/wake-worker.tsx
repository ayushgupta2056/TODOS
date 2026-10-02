"use client";

import { useEffect } from "react";

const KEY = "glimpse-woke-at";
const EVERY_MS = 4 * 60 * 1000; // Render sleeps after 15 min idle; a ping every few minutes is plenty

function wake() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < EVERY_MS) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage blocked: still wake, the server rate-limits
  }
  void fetch("/api/wake", { method: "POST", keepalive: true }).catch(() => undefined);
}

/** Wakes the face worker as soon as any page opens, and again on interaction after idle. */
export function WakeWorker() {
  useEffect(() => {
    wake();
    const onInteract = () => wake();
    window.addEventListener("pointerdown", onInteract, { passive: true });
    window.addEventListener("keydown", onInteract);
    document.addEventListener("visibilitychange", onInteract);
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      document.removeEventListener("visibilitychange", onInteract);
    };
  }, []);
  return null;
}
