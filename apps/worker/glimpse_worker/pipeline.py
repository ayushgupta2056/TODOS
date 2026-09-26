"""Pure (no I/O) photo + selfie processing. The queue/DB/storage layers call into this."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

import numpy as np

from glimpse_worker.config import Settings
from glimpse_worker.detect import detect_faces
from glimpse_worker.engine import DetectedFace, Embedding, FaceEngine
from glimpse_worker.imageops import (
    blurhash,
    decode,
    laplacian_variance,
    resized,
    to_bgr,
    watermark,
    webp_bytes,
)


@dataclass(frozen=True, slots=True)
class FaceRecord:
    # Normalised to the oriented original: 0..1
    bbox: tuple[float, float, float, float]
    landmarks: tuple[tuple[float, float], ...]
    det_score: float
    blur_score: float
    eye_distance_px: float
    # None when the face was filtered (too small / too blurry) — stored flagged, never matched.
    embedding: Embedding | None
    quality: str  # "ok" | "small" | "blurry"


@dataclass(slots=True)
class ProcessedPhoto:
    width: int
    height: int
    taken_at: datetime | None
    blurhash: str
    web: bytes
    thumb: bytes
    web_watermarked: bytes | None
    faces: list[FaceRecord] = field(default_factory=list)

    @property
    def embedded_faces(self) -> list[FaceRecord]:
        return [f for f in self.faces if f.embedding is not None]


def _norm(
    face: DetectedFace, w: int, h: int
) -> tuple[tuple[float, float, float, float], tuple[tuple[float, float], ...]]:
    bbox = (
        max(0.0, face.x / w),
        max(0.0, face.y / h),
        min(1.0, face.w / w),
        min(1.0, face.h / h),
    )
    lms = tuple((px / w, py / h) for px, py in face.landmarks)
    return bbox, lms


def analyze_faces(engine: FaceEngine, work_bgr: np.ndarray, s: Settings) -> list[FaceRecord]:
    h, w = work_bgr.shape[:2]
    out: list[FaceRecord] = []
    for face in detect_faces(engine, work_bgr, s.detect_long_edge, s.tiling, s.tile_overlap):
        bbox, lms = _norm(face, w, h)
        eye = face.eye_distance
        if eye < s.min_eye_distance_px:
            out.append(FaceRecord(bbox, lms, face.score, 0.0, eye, None, "small"))
            continue
        emb = engine.embed(work_bgr, face)
        blur = laplacian_variance(emb.aligned)
        if blur < s.min_blur_variance:
            out.append(FaceRecord(bbox, lms, face.score, blur, eye, None, "blurry"))
            continue
        out.append(FaceRecord(bbox, lms, face.score, blur, eye, emb.embedding, "ok"))
    return out


def process_photo_bytes(
    data: bytes,
    engine: FaceEngine,
    s: Settings,
    watermark_text: str | None = None,
) -> ProcessedPhoto:
    decoded = decode(data)
    img = decoded.pil
    web_img = resized(img, s.web_long_edge)
    thumb_img = resized(web_img, s.thumb_long_edge)
    work = to_bgr(resized(img, s.work_long_edge))
    return ProcessedPhoto(
        width=decoded.width,
        height=decoded.height,
        taken_at=decoded.taken_at,
        blurhash=blurhash(thumb_img),
        web=webp_bytes(web_img, s.web_quality),
        thumb=webp_bytes(thumb_img, s.thumb_quality),
        web_watermarked=(
            webp_bytes(watermark(web_img, watermark_text), s.web_quality)
            if watermark_text
            else None
        ),
        faces=analyze_faces(engine, work, s),
    )


# --- selfies ----------------------------------------------------------------------------------


class SelfieError(ValueError):
    """Friendly, user-facing selfie problems. `code` is stable for the UI."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class SelfieEmbedding:
    embedding: Embedding
    det_score: float
    blur_score: float


def embed_selfie(data: bytes, engine: FaceEngine, s: Settings) -> SelfieEmbedding:
    """Selfie bytes -> one embedding, entirely in memory. Nothing here touches disk, storage or
    logs; the caller discards the bytes afterwards."""
    try:
        decoded = decode(data)
    except ValueError as exc:
        raise SelfieError("bad_image", "We couldn't read that image. Try again.") from exc
    work = to_bgr(resized(decoded.pil, 1280))
    faces = engine.detect(work)
    if not faces:
        raise SelfieError("no_face", "We couldn't find a face. Face the camera in good light.")
    faces.sort(key=lambda f: f.area, reverse=True)
    main = faces[0]
    if len(faces) > 1 and faces[1].area > main.area * 0.4:
        raise SelfieError("multiple_faces", "Only one face, please. Step away from others.")
    if main.eye_distance < s.selfie_min_eye_distance_px:
        raise SelfieError("too_small", "Move closer so your face fills the oval.")
    emb = engine.embed(work, main)
    blur = laplacian_variance(emb.aligned)
    if blur < s.min_blur_variance:
        raise SelfieError("too_blurry", "Hold still — the photo came out blurry.")
    return SelfieEmbedding(embedding=emb.embedding, det_score=main.score, blur_score=blur)
