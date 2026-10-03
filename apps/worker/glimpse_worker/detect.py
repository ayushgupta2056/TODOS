"""Multi-pass face detection: a full-frame pass plus an overlapping 2x2 tiled pass for group
photos (YuNet is most reliable for faces ~10-300px), merged with NMS."""

from __future__ import annotations

from collections.abc import Sequence

from glimpse_worker.engine import BGRImage, DetectedFace, FaceEngine
from glimpse_worker.imageops import resize_bgr


def iou(a: DetectedFace, b: DetectedFace) -> float:
    ax2, ay2 = a.x + a.w, a.y + a.h
    bx2, by2 = b.x + b.w, b.y + b.h
    iw = max(0.0, min(ax2, bx2) - max(a.x, b.x))
    ih = max(0.0, min(ay2, by2) - max(a.y, b.y))
    inter = iw * ih
    union = a.area + b.area - inter
    return inter / union if union > 0 else 0.0


def nms(faces: Sequence[DetectedFace], iou_threshold: float = 0.3) -> list[DetectedFace]:
    kept: list[DetectedFace] = []
    for f in sorted(faces, key=lambda f: f.score, reverse=True):
        if all(iou(f, k) < iou_threshold and not _contains(k, f) for k in kept):
            kept.append(f)
    return kept


def _contains(outer: DetectedFace, inner: DetectedFace, slack: float = 0.85) -> bool:
    """True if most of `inner` lies inside `outer` (a tile edge can produce a partial box)."""
    iw = max(0.0, min(outer.x + outer.w, inner.x + inner.w) - max(outer.x, inner.x))
    ih = max(0.0, min(outer.y + outer.h, inner.y + inner.h) - max(outer.y, inner.y))
    return inner.area > 0 and (iw * ih) / inner.area >= slack


def tiles(width: int, height: int, overlap: float) -> list[tuple[int, int, int, int]]:
    """2x2 overlapping tiles as (x, y, w, h)."""
    tw = int(width * (0.5 + overlap / 2))
    th = int(height * (0.5 + overlap / 2))
    xs = (0, width - tw)
    ys = (0, height - th)
    return [(x, y, tw, th) for y in ys for x in xs]


def should_tile(mode: str, work: BGRImage, full_pass: Sequence[DetectedFace]) -> bool:
    if mode == "always":
        return True
    if mode == "never":
        return False
    h, w = work.shape[:2]
    if max(w, h) < 1400:
        return False
    # Tiles cost ~4 extra detector passes, which is slow on small hosts. Only pay for them when
    # the full pass hints at faces it may have missed: small faces or a crowded group photo.
    return len(full_pass) >= 6 or any(f.w < 48 for f in full_pass)


def detect_faces(
    engine: FaceEngine,
    work: BGRImage,
    detect_long_edge: int,
    tiling: str = "auto",
    overlap: float = 0.15,
) -> list[DetectedFace]:
    """Detect faces in `work` (the aligned working copy). Coordinates are in `work` pixels."""
    small, scale = resize_bgr(work, detect_long_edge)
    full = [f.scaled(1.0 / scale) for f in engine.detect(small)]
    if not should_tile(tiling, work, full):
        return nms(full)
    found = list(full)
    h, w = work.shape[:2]
    for x, y, tw, th in tiles(w, h, overlap):
        crop = work[y : y + th, x : x + tw]
        found.extend(f.translated(x, y) for f in engine.detect(crop))
    return nms(found)
