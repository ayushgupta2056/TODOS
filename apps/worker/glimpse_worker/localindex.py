"""Offline, file-based index for the Phase-2 proof CLI and the eval script (no DB needed)."""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np
import numpy.typing as npt

from glimpse_worker.cluster import cluster_embeddings
from glimpse_worker.config import Settings
from glimpse_worker.engine import FaceEngine
from glimpse_worker.imageops import decode, resized, to_bgr
from glimpse_worker.pipeline import analyze_faces

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def iter_images(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.suffix.lower() in IMAGE_EXTS and p.is_file())


@dataclass(slots=True)
class LocalIndex:
    engine_version: str
    embeddings: npt.NDArray[np.float32]  # (n, d)
    face_photo: list[str]
    face_cluster: list[int | None]
    centroids: dict[int, npt.NDArray[np.float32]]
    taken_at: dict[str, datetime | None]
    photos: list[str]
    skipped_faces: int

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        np.save(path / "embeddings.npy", self.embeddings)
        cids = sorted(self.centroids)
        np.save(
            path / "centroids.npy",
            np.stack([self.centroids[c] for c in cids]) if cids else np.zeros((0, 128), np.float32),
        )
        meta = {
            "engine_version": self.engine_version,
            "face_photo": self.face_photo,
            "face_cluster": self.face_cluster,
            "centroid_ids": cids,
            "taken_at": {k: (v.isoformat() if v else None) for k, v in self.taken_at.items()},
            "photos": self.photos,
            "skipped_faces": self.skipped_faces,
        }
        (path / "meta.json").write_text(json.dumps(meta))

    @classmethod
    def load(cls, path: Path) -> LocalIndex:
        meta = json.loads((path / "meta.json").read_text())
        cent = np.load(path / "centroids.npy")
        return cls(
            engine_version=meta["engine_version"],
            embeddings=np.load(path / "embeddings.npy"),
            face_photo=meta["face_photo"],
            face_cluster=meta["face_cluster"],
            centroids={c: cent[i] for i, c in enumerate(meta["centroid_ids"])},
            taken_at={
                k: (datetime.fromisoformat(v) if v else None) for k, v in meta["taken_at"].items()
            },
            photos=meta["photos"],
            skipped_faces=meta["skipped_faces"],
        )


def build_index(
    folder: Path, engine: FaceEngine, s: Settings, workers: int | None = None
) -> LocalIndex:
    files = iter_images(folder)

    def one(p: Path) -> tuple[str, datetime | None, list[npt.NDArray[np.float32]], int]:
        decoded = decode(p.read_bytes(), max_edge=s.work_long_edge)
        work = to_bgr(resized(decoded.pil, s.work_long_edge))
        faces = analyze_faces(engine, work, s)
        embs = [f.embedding for f in faces if f.embedding is not None]
        return str(p.relative_to(folder)), decoded.taken_at, embs, len(faces) - len(embs)

    with ThreadPoolExecutor(max_workers=workers or s.concurrency) as pool:
        results = list(pool.map(one, files))

    face_photo: list[str] = []
    vecs: list[npt.NDArray[np.float32]] = []
    taken: dict[str, datetime | None] = {}
    skipped = 0
    for rel, ts, embs, sk in results:
        taken[rel] = ts
        skipped += sk
        for e in embs:
            face_photo.append(rel)
            vecs.append(e)
    x = (
        np.stack(vecs).astype(np.float32)
        if vecs
        else np.zeros((0, engine.embedding_dim), np.float32)
    )
    clusters = cluster_embeddings(x, s.cluster_threshold, s.cluster_min_samples)
    face_cluster: list[int | None] = [None] * len(face_photo)
    for c in clusters:
        for m in c.members:
            face_cluster[m] = c.label
    return LocalIndex(
        engine_version=engine.version,
        embeddings=x,
        face_photo=face_photo,
        face_cluster=face_cluster,
        centroids={c.label: c.centroid for c in clusters},
        taken_at=taken,
        photos=[r[0] for r in results],
        skipped_faces=skipped,
    )
