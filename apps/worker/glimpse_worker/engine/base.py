"""The FaceEngine interface.

Everything outside `glimpse_worker.engine` talks to faces through this protocol, so a stronger
(commercially licensed) model can be swapped in later without touching the pipeline, the queue
or the database code. Every stored face records `engine.version`; embeddings from different
versions must never be compared.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np
import numpy.typing as npt

BGRImage = npt.NDArray[np.uint8]
Embedding = npt.NDArray[np.float32]


@dataclass(frozen=True, slots=True)
class DetectedFace:
    """A face in image pixel coordinates."""

    x: float
    y: float
    w: float
    h: float
    # Five landmarks: right eye, left eye, nose tip, right mouth corner, left mouth corner.
    landmarks: tuple[tuple[float, float], ...]
    score: float

    @property
    def area(self) -> float:
        return self.w * self.h

    @property
    def eye_distance(self) -> float:
        (rx, ry), (lx, ly) = self.landmarks[0], self.landmarks[1]
        return float(((rx - lx) ** 2 + (ry - ly) ** 2) ** 0.5)

    def translated(self, dx: float, dy: float) -> DetectedFace:
        return DetectedFace(
            x=self.x + dx,
            y=self.y + dy,
            w=self.w,
            h=self.h,
            landmarks=tuple((px + dx, py + dy) for px, py in self.landmarks),
            score=self.score,
        )

    def scaled(self, s: float) -> DetectedFace:
        return DetectedFace(
            x=self.x * s,
            y=self.y * s,
            w=self.w * s,
            h=self.h * s,
            landmarks=tuple((px * s, py * s) for px, py in self.landmarks),
            score=self.score,
        )


@dataclass(frozen=True, slots=True)
class EmbeddedFace:
    embedding: Embedding  # L2-normalised
    aligned: BGRImage  # aligned crop used for the embedding (never persisted)


class FaceEngine(Protocol):
    """Detect faces and turn one face into an L2-normalised embedding."""

    @property
    def version(self) -> str: ...

    @property
    def embedding_dim(self) -> int: ...

    def detect(self, img: BGRImage) -> list[DetectedFace]: ...

    def embed(self, img: BGRImage, face: DetectedFace) -> EmbeddedFace: ...


def l2_normalize(v: npt.NDArray[np.floating]) -> Embedding:
    v = np.asarray(v, dtype=np.float32).reshape(-1)
    n = float(np.linalg.norm(v))
    if n == 0.0:
        return v
    return (v / n).astype(np.float32)
