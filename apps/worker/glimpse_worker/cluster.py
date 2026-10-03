"""Event-scoped face clustering (DBSCAN-style on cosine similarity).

Memory-safe for large events: similarities are computed in row blocks, keeping only the edges
above the threshold. Faces are L2-normalised so cosine similarity is a dot product.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

from glimpse_worker.engine import l2_normalize

NOISE = -1


@dataclass(frozen=True, slots=True)
class Cluster:
    label: int
    members: list[int]  # indices into the input matrix
    centroid: npt.NDArray[np.float32]  # L2-normalised mean
    representative: int  # member closest to the centroid


def _neighbors(
    x: npt.NDArray[np.float32], threshold: float, block: int = 2048
) -> list[npt.NDArray[np.intp]]:
    n = x.shape[0]
    out: list[npt.NDArray[np.intp]] = []
    for start in range(0, n, block):
        sims = x[start : start + block] @ x.T
        for row in sims:
            out.append(np.flatnonzero(row >= threshold))
    return out


def dbscan_cosine(
    x: npt.NDArray[np.float32], threshold: float, min_samples: int = 2
) -> npt.NDArray[np.intp]:
    """Labels per row (NOISE = -1). `min_samples` counts the point itself."""
    n = x.shape[0]
    labels = np.full(n, NOISE, dtype=np.intp)
    if n == 0:
        return labels
    nbrs = _neighbors(x, threshold)
    core = np.array([len(nb) >= min_samples for nb in nbrs])
    label = 0
    for i in range(n):
        if labels[i] != NOISE or not core[i]:
            continue
        labels[i] = label
        stack = [i]
        while stack:
            j = stack.pop()
            if not core[j]:
                continue
            for k in nbrs[j]:
                if labels[k] == NOISE:
                    labels[k] = label
                    if core[k]:
                        stack.append(int(k))
        label += 1
    return labels


def cluster_embeddings(
    x: npt.NDArray[np.float32], threshold: float, min_samples: int = 2
) -> list[Cluster]:
    labels = dbscan_cosine(x, threshold, min_samples)
    clusters: list[Cluster] = []
    for lab in sorted(set(labels.tolist()) - {NOISE}):
        idx = np.flatnonzero(labels == lab)
        centroid = l2_normalize(x[idx].mean(axis=0))
        rep = int(idx[int(np.argmax(x[idx] @ centroid))])
        clusters.append(Cluster(lab, idx.tolist(), centroid, rep))
    return clusters
