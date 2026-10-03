"""`glimpse-face` CLI.

glimpse-face models                      download + verify YuNet/SFace
glimpse-face index ./photos              detect, embed, cluster -> ./.index
glimpse-face search selfie.jpg           print matching files
glimpse-face bench ./photos              photos/sec/core
glimpse-face serve                       HTTP API (+ queue consumer with --consume)
glimpse-face consume                     queue consumer only
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from glimpse_worker.config import get_settings
from glimpse_worker.models import ensure_all


def _cmd_models(_: argparse.Namespace) -> int:
    for name, path in ensure_all(get_settings().models_dir).items():
        print(f"ok  {name}  ->  {path}")
    return 0


def _cmd_index(a: argparse.Namespace) -> int:
    from glimpse_worker.engine import get_engine
    from glimpse_worker.localindex import build_index

    s = get_settings()
    t0 = time.perf_counter()
    idx = build_index(Path(a.folder), get_engine(), s, workers=a.workers)
    dt = time.perf_counter() - t0
    idx.save(Path(a.out))
    people = len(idx.centroids)
    print(
        f"indexed {len(idx.photos)} photos, {len(idx.face_photo)} faces "
        f"({idx.skipped_faces} filtered), {people} people in {dt:.1f}s -> {a.out}"
    )
    return 0


def _cmd_search(a: argparse.Namespace) -> int:
    from glimpse_worker.engine import get_engine
    from glimpse_worker.localindex import LocalIndex
    from glimpse_worker.matching import rank_photos
    from glimpse_worker.pipeline import SelfieError, embed_selfie

    s = get_settings()
    idx = LocalIndex.load(Path(a.index))
    engine = get_engine()
    if idx.engine_version != engine.version:
        print(f"index built with {idx.engine_version}, engine is {engine.version}", file=sys.stderr)
        return 2
    try:
        selfie = embed_selfie(Path(a.selfie).read_bytes(), engine, s)
    except SelfieError as e:
        print(f"{e.code}: {e.message}", file=sys.stderr)
        return 1
    matches = rank_photos(
        selfie.embedding,
        idx.embeddings,
        idx.face_photo,
        idx.face_cluster,
        idx.centroids,
        idx.taken_at,
        a.threshold if a.threshold is not None else s.match_threshold,
        a.cluster_threshold if a.cluster_threshold is not None else s.cluster_match_threshold,
    )
    for m in matches:
        tag = " (cluster)" if m.via_cluster else ""
        print(f"{m.score:.3f}  {m.photo}{tag}")
    print(f"{len(matches)} photos", file=sys.stderr)
    return 0


def _cmd_bench(a: argparse.Namespace) -> int:
    from glimpse_worker.engine import get_engine
    from glimpse_worker.localindex import iter_images
    from glimpse_worker.pipeline import process_photo_bytes

    s = get_settings()
    engine = get_engine()
    files = iter_images(Path(a.folder))[: a.limit]
    datas = [p.read_bytes() for p in files]
    process_photo_bytes(datas[0], engine, s)  # warm-up
    t0 = time.perf_counter()
    faces = 0
    for d in datas:
        faces += len(process_photo_bytes(d, engine, s).faces)
    dt = time.perf_counter() - t0
    print(f"{len(datas)} photos, {faces} faces, {len(datas) / dt:.2f} photos/sec on one core")
    return 0


def _cmd_serve(a: argparse.Namespace) -> int:
    import uvicorn

    if a.consume:
        os.environ["GLIMPSE_START_CONSUMER"] = "1"
    uvicorn.run("glimpse_worker.api:app", host=a.host, port=a.port, log_level="info")
    return 0


def _cmd_consume(_: argparse.Namespace) -> int:
    from glimpse_worker.queue import run_consumer

    run_consumer()
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="glimpse-face")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("models").set_defaults(fn=_cmd_models)

    pi = sub.add_parser("index")
    pi.add_argument("folder")
    pi.add_argument("--out", default=".index")
    pi.add_argument("--workers", type=int, default=None)
    pi.set_defaults(fn=_cmd_index)

    ps = sub.add_parser("search")
    ps.add_argument("selfie")
    ps.add_argument("--index", default=".index")
    ps.add_argument("--threshold", type=float, default=None)
    ps.add_argument("--cluster-threshold", type=float, default=None)
    ps.set_defaults(fn=_cmd_search)

    pb = sub.add_parser("bench")
    pb.add_argument("folder")
    pb.add_argument("--limit", type=int, default=50)
    pb.set_defaults(fn=_cmd_bench)

    pv = sub.add_parser("serve")
    pv.add_argument("--host", default="0.0.0.0")
    pv.add_argument("--port", type=int, default=8787)
    pv.add_argument("--consume", action="store_true")
    pv.set_defaults(fn=_cmd_serve)

    sub.add_parser("consume").set_defaults(fn=_cmd_consume)

    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    raise SystemExit(main())
