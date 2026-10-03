"""FaceEngine implementation on OpenCV DNN: YuNet (MIT) detection + SFace (Apache-2.0) embedding."""

from __future__ import annotations

import threading
from pathlib import Path

import cv2
import numpy as np

from glimpse_worker.engine.base import (
    BGRImage,
    DetectedFace,
    EmbeddedFace,
    l2_normalize,
)
from glimpse_worker.models import SFACE, YUNET, ensure_model

ENGINE_VERSION = "yunet2023mar+sface2021dec/v1"


class OpenCVFaceEngine:
    """Thread-safe wrapper: OpenCV DNN objects are not safe to share across threads, so each
    thread lazily gets its own detector/recognizer pair."""

    def __init__(
        self,
        models_dir: Path,
        score_threshold: float = 0.7,
        nms_threshold: float = 0.3,
        top_k: int = 5000,
    ) -> None:
        self._det_path = str(ensure_model(YUNET, models_dir))
        self._rec_path = str(ensure_model(SFACE, models_dir))
        self._score = score_threshold
        self._nms = nms_threshold
        self._top_k = top_k
        self._local = threading.local()

    @property
    def version(self) -> str:
        return ENGINE_VERSION

    @property
    def embedding_dim(self) -> int:
        return 128

    def _detector(self) -> cv2.FaceDetectorYN:
        det = getattr(self._local, "det", None)
        if det is None:
            det = cv2.FaceDetectorYN.create(
                self._det_path, "", (320, 320), self._score, self._nms, self._top_k
            )
            self._local.det = det
        return det

    def _recognizer(self) -> cv2.FaceRecognizerSF:
        rec = getattr(self._local, "rec", None)
        if rec is None:
            rec = cv2.FaceRecognizerSF.create(self._rec_path, "")
            self._local.rec = rec
        return rec

    def detect(self, img: BGRImage) -> list[DetectedFace]:
        h, w = img.shape[:2]
        det = self._detector()
        det.setInputSize((w, h))
        _, faces = det.detect(img)
        if faces is None:
            return []
        out: list[DetectedFace] = []
        for row in faces:
            r = [float(v) for v in row]
            out.append(
                DetectedFace(
                    x=r[0],
                    y=r[1],
                    w=r[2],
                    h=r[3],
                    landmarks=tuple((r[4 + 2 * i], r[5 + 2 * i]) for i in range(5)),
                    score=r[14],
                )
            )
        return out

    def embed(self, img: BGRImage, face: DetectedFace) -> EmbeddedFace:
        row = np.array(
            [face.x, face.y, face.w, face.h, *[c for p in face.landmarks for c in p], face.score],
            dtype=np.float32,
        )
        rec = self._recognizer()
        aligned = np.asarray(rec.alignCrop(img, row), dtype=np.uint8)
        feat = np.asarray(rec.feature(aligned), dtype=np.float32)
        return EmbeddedFace(embedding=l2_normalize(feat), aligned=aligned)
