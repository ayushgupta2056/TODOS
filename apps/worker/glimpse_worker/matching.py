"""Selfie -> photos ranking. Mirrors the SQL in packages/db (search_event_faces) so the CLI,
the eval script and production rank identically."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import numpy.typing as npt


@dataclass(frozen=True, slots=True)
class PhotoMatch:
    photo: str
    score: float
    via_cluster: bool
    taken_at: datetime | None


def rank_photos(
    query: npt.NDArray[np.float32],
    embeddings: npt.NDArray[np.float32],
    face_photo: Sequence[str],
    face_cluster: Sequence[int | None],
    centroids: dict[int, npt.NDArray[np.float32]],
    taken_at: dict[str, datetime | None],
    threshold: float,
    cluster_threshold: float,
) -> list[PhotoMatch]:
    """Direct matches (cosine >= threshold) plus every photo of a cluster whose centroid passes the
    stricter `cluster_threshold`. Ranked by score desc, then time asc."""
    best: dict[str, tuple[float, bool]] = {}
    if len(embeddings):
        sims = embeddings @ query
        for hit in np.flatnonzero(sims >= threshold).tolist():
            p = face_photo[hit]
            s = float(sims[hit])
            if p not in best or best[p][0] < s:
                best[p] = (s, False)
    strong = {c for c, v in centroids.items() if float(v @ query) >= cluster_threshold}
    if strong:
        for i, c in enumerate(face_cluster):
            if c is not None and c in strong:
                p = face_photo[i]
                s = float(centroids[c] @ query)
                if p not in best:
                    best[p] = (s, True)
    matches = [PhotoMatch(p, s, v, taken_at.get(p)) for p, (s, v) in best.items()]
    far_future = datetime.max.replace(tzinfo=None)
    matches.sort(
        key=lambda m: (
            -round(m.score, 3),
            (m.taken_at.replace(tzinfo=None) if m.taken_at else far_future),
            m.photo,
        )
    )
    return matches
