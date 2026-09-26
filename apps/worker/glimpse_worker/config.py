"""Runtime configuration, read from environment variables (see apps/worker/.env.example)."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

WORKER_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    # --- models -----------------------------------------------------------
    models_dir: Path = Field(default=WORKER_ROOT / "models")

    # --- detection --------------------------------------------------------
    det_score_threshold: float = 0.7
    det_nms_threshold: float = 0.3
    # Long edge of the working copy used for alignment + tiling.
    work_long_edge: int = 2048
    # Long edge of the full-frame detection pass.
    detect_long_edge: int = 1600
    # "auto" tiles large images; "always" / "never" force it.
    tiling: str = "auto"
    tile_overlap: float = 0.15

    # --- quality filter ---------------------------------------------------
    min_eye_distance_px: float = 20.0
    min_blur_variance: float = 35.0
    selfie_min_eye_distance_px: float = 30.0

    # --- matching ---------------------------------------------------------
    # SFace's reference cosine threshold is 0.363. Tuned with eval/evaluate.py (see
    # docs/phase-2.md): 0.42 balanced precision/recall at ~0.97/0.97 on the LFW eval set.
    match_threshold: float = 0.42
    # Clustering links faces at this cosine similarity (stricter than matching).
    cluster_threshold: float = 0.55
    cluster_min_samples: int = 2
    # A selfie pulls in a whole cluster only if the cluster centroid passes this.
    cluster_match_threshold: float = 0.55

    # --- derivatives ------------------------------------------------------
    web_long_edge: int = 2048
    web_quality: int = 80
    thumb_long_edge: int = 480
    thumb_quality: int = 75

    # --- infrastructure ---------------------------------------------------
    database_url: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    s3_endpoint: str = "http://127.0.0.1:8333"
    s3_region: str = "us-east-1"  # R2 accepts "auto" or "us-east-1"
    s3_bucket: str = "glimpse"
    s3_access_key_id: str = "glimpse"
    s3_secret_access_key: str = "glimpse-secret"

    worker_token: str = "dev-worker-token"
    concurrency: int = Field(default_factory=lambda: os.cpu_count() or 1)
    poll_interval_s: float = 1.0
    job_max_attempts: int = 5
    lock_timeout_s: int = 600
    cluster_debounce_s: int = 20


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
