import "server-only";
import { env } from "./env";
import { signToken, verifyToken } from "./crypto";

/** Short-lived capability to upload into one event, so part-signing needs no DB round trip. */
export interface UploadToken {
  kind: "upload";
  studio: string;
  event: string;
  exp: number;
}

export function mintUploadToken(studio: string, event: string, ttlSeconds = 6 * 3600): Promise<string> {
  return signToken(
    { kind: "upload", studio, event, exp: Math.floor(Date.now() / 1000) + ttlSeconds } satisfies UploadToken,
    env().GUEST_SECRET,
  );
}

export async function readUploadToken(token: string | null | undefined): Promise<UploadToken | null> {
  const t = await verifyToken<UploadToken>(token ?? undefined, env().GUEST_SECRET);
  if (!t || t.kind !== "upload" || t.exp < Date.now() / 1000) return null;
  return t;
}

export const ORIGINAL_KEY = /^events\/([0-9a-f-]{36})\/original\/[0-9a-f-]{36}\.(jpe?g|png|webp|tiff?)$/;
