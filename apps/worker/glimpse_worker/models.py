"""Download the YuNet + SFace ONNX models from the official opencv_zoo repo, verifying SHA-256.

Both are licensed for commercial use: YuNet (MIT), SFace (Apache-2.0). Licence texts live in
/licenses at the repo root. Do NOT add InsightFace packs (buffalo_l, antelopev2 …): their
weights are non-commercial.
"""

from __future__ import annotations

import hashlib
import shutil
import tempfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path

_ZOO = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models"


@dataclass(frozen=True)
class ModelFile:
    name: str
    url: str
    sha256: str
    license: str


YUNET = ModelFile(
    name="face_detection_yunet_2023mar.onnx",
    url=f"{_ZOO}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    sha256="8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    license="MIT",
)
SFACE = ModelFile(
    name="face_recognition_sface_2021dec.onnx",
    url=f"{_ZOO}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
    sha256="0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    license="Apache-2.0",
)
ALL_MODELS = (YUNET, SFACE)


class ChecksumError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_model(model: ModelFile, models_dir: Path) -> Path:
    """Return the local path of `model`, downloading and verifying it if needed."""
    models_dir.mkdir(parents=True, exist_ok=True)
    target = models_dir / model.name
    if target.exists():
        if sha256_file(target) == model.sha256:
            return target
        target.unlink()
    with tempfile.NamedTemporaryFile(dir=models_dir, delete=False) as tmp:
        tmp_path = Path(tmp.name)
        with urllib.request.urlopen(model.url, timeout=120) as resp:
            shutil.copyfileobj(resp, tmp)
    digest = sha256_file(tmp_path)
    if digest != model.sha256:
        tmp_path.unlink(missing_ok=True)
        raise ChecksumError(f"{model.name}: expected sha256 {model.sha256}, got {digest}")
    tmp_path.replace(target)
    return target


def ensure_all(models_dir: Path) -> dict[str, Path]:
    return {m.name: ensure_model(m, models_dir) for m in ALL_MODELS}
