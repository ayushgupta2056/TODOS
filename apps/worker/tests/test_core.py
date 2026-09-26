from __future__ import annotations

import io
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from glimpse_worker.cluster import NOISE, cluster_embeddings, dbscan_cosine
from glimpse_worker.config import Settings
from glimpse_worker.detect import iou, nms, should_tile, tiles
from glimpse_worker.engine import DetectedFace, EmbeddedFace, l2_normalize
from glimpse_worker.imageops import blurhash, decode, laplacian_variance, resized
from glimpse_worker.matching import rank_photos
from glimpse_worker.models import ChecksumError, ModelFile, ensure_model
from glimpse_worker.pipeline import SelfieError, embed_selfie, process_photo_bytes

LMS = ((10.0, 10.0), (40.0, 10.0), (25.0, 25.0), (12.0, 40.0), (38.0, 40.0))


def face(
    x: float, y: float, w: float = 50, h: float = 50, score: float = 0.9, eye: float = 30
) -> DetectedFace:
    lms = (
        (x + 10, y + 15),
        (x + 10 + eye, y + 15),
        (x + 25, y + 30),
        (x + 12, y + 40),
        (x + 38, y + 40),
    )
    return DetectedFace(x, y, w, h, lms, score)


def jpeg(w: int = 800, h: int = 600, noise: bool = True) -> bytes:
    rng = np.random.default_rng(0)
    arr = (
        rng.integers(0, 255, (h, w, 3), dtype=np.uint8)
        if noise
        else np.full((h, w, 3), 128, np.uint8)
    )
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="JPEG")
    return buf.getvalue()


class FakeEngine:
    """Deterministic engine: returns preset faces and an embedding derived from face position."""

    def __init__(self, faces: list[DetectedFace]) -> None:
        self.faces = faces

    @property
    def version(self) -> str:
        return "fake/v1"

    @property
    def embedding_dim(self) -> int:
        return 128

    def detect(self, img: np.ndarray) -> list[DetectedFace]:
        h, w = img.shape[:2]
        return [f for f in self.faces if f.x + f.w <= w and f.y + f.h <= h]

    def embed(self, img: np.ndarray, f: DetectedFace) -> EmbeddedFace:
        v = np.zeros(128, np.float32)
        v[int(f.x) % 128] = 1.0
        rng = np.random.default_rng(int(f.x))
        aligned = rng.integers(0, 255, (112, 112, 3), dtype=np.uint8)
        return EmbeddedFace(l2_normalize(v), aligned)


# --- geometry ---------------------------------------------------------------------------------


def test_iou_identical_and_disjoint() -> None:
    assert iou(face(0, 0), face(0, 0)) == pytest.approx(1.0)
    assert iou(face(0, 0), face(500, 500)) == 0.0


def test_nms_keeps_highest_and_drops_contained() -> None:
    a = face(0, 0, score=0.95)
    b = face(5, 5, score=0.8)  # heavy overlap
    c = DetectedFace(10, 10, 20, 20, LMS, 0.9)  # inside a
    d = face(300, 300, score=0.7)
    kept = nms([b, c, a, d])
    assert a in kept and d in kept and b not in kept and c not in kept


def test_tiles_cover_image() -> None:
    ts = tiles(2000, 1000, 0.15)
    assert len(ts) == 4
    xs = {(x, x + w) for x, _, w, _ in ts}
    assert min(a for a, _ in xs) == 0 and max(b for _, b in xs) == 2000


def test_should_tile_modes() -> None:
    big = np.zeros((1600, 2400, 3), np.uint8)
    small = np.zeros((600, 800, 3), np.uint8)
    assert should_tile("always", small, [])
    assert not should_tile("never", big, [])
    assert not should_tile("auto", small, [])
    assert should_tile("auto", big, [face(0, 0), face(200, 0)])
    assert not should_tile("auto", big, [face(0, 0, w=200, h=200)])


def test_translate_scale() -> None:
    f = face(10, 20).translated(5, 5).scaled(2)
    assert (f.x, f.y) == (30, 50)
    assert f.eye_distance == pytest.approx(60)


# --- vectors + clustering ---------------------------------------------------------------------


def test_l2_normalize() -> None:
    v = l2_normalize(np.array([3.0, 4.0]))
    assert float(np.linalg.norm(v)) == pytest.approx(1.0)
    assert l2_normalize(np.zeros(3)).sum() == 0


def _people(n_people: int, per: int, noise: float, seed: int = 1) -> tuple[np.ndarray, list[int]]:
    rng = np.random.default_rng(seed)
    centers = [l2_normalize(rng.normal(size=128)) for _ in range(n_people)]
    xs, ys = [], []
    for i, c in enumerate(centers):
        for _ in range(per):
            xs.append(l2_normalize(c + rng.normal(scale=noise, size=128)))
            ys.append(i)
    return np.stack(xs).astype(np.float32), ys


def test_dbscan_separates_people() -> None:
    x, y = _people(4, 6, 0.05)
    labels = dbscan_cosine(x, 0.5, 2)
    assert NOISE not in labels
    for person in range(4):
        assert len({labels[i] for i, p in enumerate(y) if p == person}) == 1
    assert len(set(labels.tolist())) == 4


def test_cluster_centroid_and_representative() -> None:
    x, _ = _people(2, 5, 0.05)
    cs = cluster_embeddings(x, 0.5)
    assert len(cs) == 2
    for c in cs:
        assert float(np.linalg.norm(c.centroid)) == pytest.approx(1.0, abs=1e-5)
        assert c.representative in c.members


def test_rank_direct_and_cluster_expansion() -> None:
    x, y = _people(2, 4, 0.05)
    photos = [f"p{i}" for i in range(len(y))]
    cs = cluster_embeddings(x, 0.5)
    face_cluster: list[int | None] = [None] * len(y)
    for c in cs:
        for m in c.members:
            face_cluster[m] = c.label
    q = x[0]
    # impossible direct threshold: only cluster expansion can match
    got = rank_photos(q, x, photos, face_cluster, {c.label: c.centroid for c in cs}, {}, 1.01, 0.5)
    assert {m.photo for m in got} == {p for p, who in zip(photos, y, strict=True) if who == 0}
    assert all(m.via_cluster for m in got)
    direct = rank_photos(q, x, photos, face_cluster, {}, {}, 0.5, 0.99)
    assert direct[0].photo == "p0" and not direct[0].via_cluster
    assert all(y[photos.index(m.photo)] == 0 for m in direct)


def test_rank_ties_break_by_time() -> None:
    e = l2_normalize(np.ones(128))
    x = np.stack([e, e]).astype(np.float32)
    t = {"a": datetime(2025, 1, 2, tzinfo=UTC), "b": datetime(2025, 1, 1, tzinfo=UTC)}
    got = rank_photos(e, x, ["a", "b"], [None, None], {}, t, 0.5, 0.9)
    assert [m.photo for m in got] == ["b", "a"]


# --- images -----------------------------------------------------------------------------------


def test_decode_fixes_exif_orientation() -> None:
    img = Image.new("RGB", (40, 20), "white")
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 CW
    exif[0x0132] = "2025:02:14 18:30:00"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    d = decode(buf.getvalue())
    assert (d.width, d.height) == (20, 40)
    assert d.taken_at == datetime(2025, 2, 14, 18, 30, tzinfo=UTC)


def test_decode_rejects_garbage() -> None:
    with pytest.raises(ValueError):
        decode(b"not an image")


def test_resized_never_upscales() -> None:
    img = Image.new("RGB", (100, 50))
    assert resized(img, 200).size == (100, 50)
    assert resized(img, 50).size == (50, 25)


def test_blurhash_shape() -> None:
    h = blurhash(Image.new("RGB", (64, 48), (255, 138, 61)))
    assert len(h) == 4 + 2 * (4 * 3 - 1) + 2


def test_laplacian_variance_detects_blur() -> None:
    sharp = np.random.default_rng(0).integers(0, 255, (112, 112, 3), dtype=np.uint8)
    flat = np.full((112, 112, 3), 120, np.uint8)
    assert laplacian_variance(sharp) > laplacian_variance(flat)


# --- pipeline with a fake engine ---------------------------------------------------------------


def test_process_photo_filters_and_derivatives() -> None:
    s = Settings(tiling="never", min_eye_distance_px=20)
    eng = FakeEngine([face(100, 100, eye=40), face(300, 100, eye=8)])
    out = process_photo_bytes(jpeg(), eng, s, watermark_text="Studio")
    assert (out.width, out.height) == (800, 600)
    qualities = sorted(f.quality for f in out.faces)
    assert qualities == ["ok", "small"]
    assert len(out.embedded_faces) == 1
    assert out.web[:4] == b"RIFF" and out.thumb[:4] == b"RIFF"
    assert out.web_watermarked is not None
    x, y, w, h = out.faces[0].bbox
    assert 0 <= x <= 1 and 0 <= y <= 1 and 0 < w <= 1 and 0 < h <= 1


def test_process_photo_is_deterministic() -> None:
    s = Settings(tiling="never")
    eng = FakeEngine([face(100, 100, eye=40)])
    a = process_photo_bytes(jpeg(), eng, s)
    b = process_photo_bytes(jpeg(), eng, s)
    assert len(a.faces) == len(b.faces)
    assert a.faces[0].bbox == b.faces[0].bbox


def test_selfie_errors() -> None:
    s = Settings()
    with pytest.raises(SelfieError) as e:
        embed_selfie(b"garbage", FakeEngine([]), s)
    assert e.value.code == "bad_image"
    with pytest.raises(SelfieError) as e:
        embed_selfie(jpeg(), FakeEngine([]), s)
    assert e.value.code == "no_face"
    with pytest.raises(SelfieError) as e:
        embed_selfie(jpeg(), FakeEngine([face(100, 100, eye=40), face(300, 100, eye=40)]), s)
    assert e.value.code == "multiple_faces"
    with pytest.raises(SelfieError) as e:
        embed_selfie(jpeg(), FakeEngine([face(100, 100, eye=10)]), s)
    assert e.value.code == "too_small"
    ok = embed_selfie(
        jpeg(), FakeEngine([face(100, 100, 200, 200, eye=60), face(400, 100, 30, 30)]), s
    )
    assert float(np.linalg.norm(ok.embedding)) == pytest.approx(1.0)


# --- models -----------------------------------------------------------------------------------


def test_checksum_mismatch_is_rejected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    src = tmp_path / "src.onnx"
    src.write_bytes(b"tampered")
    bad = ModelFile("m.onnx", src.as_uri(), "0" * 64, "MIT")
    with pytest.raises(ChecksumError):
        ensure_model(bad, tmp_path / "models")
    assert not (tmp_path / "models" / "m.onnx").exists()
