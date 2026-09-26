"""Threshold tuning on a labelled folder.

Layout:  <root>/<person_x>/*.jpg   (one folder per person; the person must be in each photo)

For every person with >= --min-photos photos, the first photo becomes the "selfie" and the
remaining photos join one shared "event" gallery, together with distractor people. We then
search the gallery with each selfie and report micro-averaged precision / recall / F1 per
threshold, with and without cluster expansion.

    uv run python eval/evaluate.py ./eval/data/lfw --max-people 150 --csv eval/results.csv

Keep evaluation data out of git (eval/data/ is ignored). Datasets like LFW are research-only:
use them to tune thresholds locally, never ship them or train on them.
"""

from __future__ import annotations

import argparse
import csv
import random
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from glimpse_worker.cluster import cluster_embeddings
from glimpse_worker.config import get_settings
from glimpse_worker.engine import get_engine
from glimpse_worker.imageops import decode, resized, to_bgr
from glimpse_worker.localindex import iter_images
from glimpse_worker.matching import rank_photos
from glimpse_worker.pipeline import SelfieError, analyze_faces, embed_selfie


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path)
    ap.add_argument("--min-photos", type=int, default=4)
    ap.add_argument("--max-people", type=int, default=100)
    ap.add_argument(
        "--distractors", type=int, default=300, help="single-photo people added as noise"
    )
    ap.add_argument("--thresholds", default="0.25,0.30,0.33,0.363,0.40,0.45,0.50,0.55")
    ap.add_argument("--cluster-threshold", type=float, default=None)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--csv", type=Path, default=None)
    a = ap.parse_args()

    s = get_settings()
    engine = get_engine()
    rng = random.Random(a.seed)

    people = sorted(p for p in a.root.iterdir() if p.is_dir())
    rich = [p for p in people if len(iter_images(p)) >= a.min_photos]
    rng.shuffle(rich)
    rich = rich[: a.max_people]
    poor = [p for p in people if len(iter_images(p)) == 1]
    rng.shuffle(poor)
    poor = poor[: a.distractors]

    queries: dict[str, Path] = {}
    gallery: list[tuple[str, Path]] = []  # (person, file)
    for p in rich:
        files = iter_images(p)
        queries[p.name] = files[0]
        gallery.extend((p.name, f) for f in files[1:])
    for p in poor:
        gallery.extend((p.name, f) for f in iter_images(p))

    print(f"{len(queries)} people queried, {len(gallery)} gallery photos")

    def index_one(item: tuple[str, Path]) -> tuple[str, list[np.ndarray]]:
        _, f = item
        work = to_bgr(resized(decode(f.read_bytes()).pil, s.work_long_edge))
        return str(f), [
            x.embedding for x in analyze_faces(engine, work, s) if x.embedding is not None
        ]

    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=s.concurrency) as pool:
        indexed = list(pool.map(index_one, gallery))
    dt = time.perf_counter() - t0
    print(f"indexed in {dt:.1f}s ({len(gallery) / dt:.1f} photos/s with {s.concurrency} threads)")

    face_photo: list[str] = []
    vecs: list[np.ndarray] = []
    for photo, embs in indexed:
        for e in embs:
            face_photo.append(photo)
            vecs.append(e)
    x = np.stack(vecs).astype(np.float32)
    clusters = cluster_embeddings(x, s.cluster_threshold, s.cluster_min_samples)
    face_cluster: list[int | None] = [None] * len(face_photo)
    for c in clusters:
        for m in c.members:
            face_cluster[m] = c.label
    centroids = {c.label: c.centroid for c in clusters}
    print(f"{len(face_photo)} faces, {len(clusters)} clusters")

    truth: dict[str, set[str]] = {}
    for person, f in gallery:
        truth.setdefault(person, set()).add(str(f))

    selfies: dict[str, np.ndarray] = {}
    for person, q in queries.items():
        try:
            selfies[person] = embed_selfie(q.read_bytes(), engine, s).embedding
        except SelfieError as e:
            print(f"  skip {person}: {e.code}")

    cth = a.cluster_threshold if a.cluster_threshold is not None else s.cluster_match_threshold
    rows: list[dict[str, float | str]] = []
    print(f"\n{'mode':<10}{'thresh':>8}{'precision':>11}{'recall':>9}{'f1':>8}")
    for mode in ("direct", "cluster"):
        for th in [float(t) for t in a.thresholds.split(",")]:
            tp = fp = fn = 0
            for person, emb in selfies.items():
                got = rank_photos(
                    emb,
                    x,
                    face_photo,
                    face_cluster,
                    centroids if mode == "cluster" else {},
                    {},
                    th,
                    cth,
                )
                pred = {m.photo for m in got}
                want = truth[person]
                tp += len(pred & want)
                fp += len(pred - want)
                fn += len(want - pred)
            p = tp / (tp + fp) if tp + fp else 1.0
            r = tp / (tp + fn) if tp + fn else 0.0
            f1 = 2 * p * r / (p + r) if p + r else 0.0
            print(f"{mode:<10}{th:>8.3f}{p:>11.3f}{r:>9.3f}{f1:>8.3f}")
            rows.append({"mode": mode, "threshold": th, "precision": p, "recall": r, "f1": f1})

    if a.csv:
        with a.csv.open("w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print(f"\nwrote {a.csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
