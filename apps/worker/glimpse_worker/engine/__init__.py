from __future__ import annotations

from functools import lru_cache

from glimpse_worker.config import get_settings
from glimpse_worker.engine.base import (
    BGRImage,
    DetectedFace,
    EmbeddedFace,
    Embedding,
    FaceEngine,
    l2_normalize,
)

__all__ = [
    "BGRImage",
    "DetectedFace",
    "EmbeddedFace",
    "Embedding",
    "FaceEngine",
    "get_engine",
    "l2_normalize",
]


@lru_cache(maxsize=1)
def get_engine() -> FaceEngine:
    """The one place that picks the concrete engine."""
    from glimpse_worker.engine.opencv_engine import OpenCVFaceEngine

    s = get_settings()
    return OpenCVFaceEngine(
        s.models_dir, score_threshold=s.det_score_threshold, nms_threshold=s.det_nms_threshold
    )
