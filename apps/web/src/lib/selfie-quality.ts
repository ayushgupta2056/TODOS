// On-device selfie quality hints. Pure so it can be unit-tested; the camera component feeds it
// MediaPipe face boxes (in video pixels) and a cheap brightness sample.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Hint = "no_face" | "multiple" | "closer" | "back" | "center" | "light" | "still" | "ok";

export const HINT_COPY: Record<Hint, string> = {
  no_face: "Look at the camera",
  multiple: "Just you in the frame, please",
  closer: "Move closer",
  back: "Move back a little",
  center: "Center your face in the oval",
  light: "More light, please",
  still: "Hold still",
  ok: "Perfect — take the photo",
};

export interface FrameInput {
  faces: Box[];
  frameW: number;
  frameH: number;
  brightness: number; // 0..255 mean luma
  previous?: Box | null | undefined;
}

export function assessFrame({ faces, frameW, frameH, brightness, previous }: FrameInput): { hint: Hint; face: Box | null } {
  if (!faces.length) return { hint: brightness < 45 ? "light" : "no_face", face: null };
  const sorted = [...faces].sort((a, b) => b.w * b.h - a.w * a.h);
  const face = sorted[0]!;
  const second = sorted[1];
  if (second && second.w * second.h > face.w * face.h * 0.4) return { hint: "multiple", face };
  if (brightness < 55) return { hint: "light", face };
  const short = Math.min(frameW, frameH);
  const rel = face.w / short;
  if (rel < 0.28) return { hint: "closer", face };
  if (rel > 0.75) return { hint: "back", face };
  const cx = (face.x + face.w / 2) / frameW;
  const cy = (face.y + face.h / 2) / frameH;
  if (Math.abs(cx - 0.5) > 0.14 || cy < 0.28 || cy > 0.62) return { hint: "center", face };
  if (previous) {
    const move = Math.hypot(face.x - previous.x, face.y - previous.y) / face.w;
    if (move > 0.08) return { hint: "still", face };
  }
  return { hint: "ok", face };
}
