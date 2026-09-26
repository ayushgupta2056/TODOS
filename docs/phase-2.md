# Phase 2 — Face engine proof

**Built (`apps/worker`):**
- `FaceEngine` protocol (`detect`, `embed`, `version`) with an OpenCV implementation: **YuNet 2023mar (MIT)** +
  **SFace 2021dec (Apache-2.0)**, downloaded from `opencv/opencv_zoo` with pinned SHA-256 (`glimpse-face models`).
- Pipeline: EXIF orientation, reduced-scale JPEG decode, 2048px web + 480px thumb WebP, blurhash, full-frame YuNet
  pass (score ≥ 0.7) + an overlapping 2×2 tiled pass for group shots merged with NMS, a quality filter (eye distance < 20px or
  Laplacian variance < 35 → stored flagged, never embedded), `alignCrop` → `feature` → L2-normalise.
- Event clustering: DBSCAN on cosine similarity, block-wise so large events don't blow memory.
- Ranking identical to production SQL: direct matches plus cluster expansion when the centroid passes a stricter threshold.
- CLI: `glimpse-face index <folder>`, `glimpse-face search selfie.jpg`, `glimpse-face bench <folder>`.
- `eval/evaluate.py`: labelled folder → precision/recall/F1 per threshold, with and without cluster expansion.

**Evaluation (LFW subset: 120 people queried, 300 distractors, 1,388 gallery photos):**

| threshold | precision | recall | F1 |
|---|---|---|---|
| 0.363 (SFace reference) | 0.872 | 0.978 | 0.922 |
| 0.40 | 0.950 | 0.974 | 0.962 |
| **0.42 (default)** | **0.973** | **0.970** | **0.971** |
| 0.45 | 0.990 | 0.955 | 0.972 |
| 0.42 + cluster expansion (link 0.55, centroid 0.55) | 0.974 | 0.974 | 0.974 |

The default is 0.42 rather than 0.363: at 0.363, about 1 in 8 returned photos was someone else, which is a privacy problem
at an event. LFW is news photos of celebrities. **Re-tune on real event photos** (varied light, profiles) before launch:
`uv run python eval/evaluate.py <folder> --thresholds 0.35,0.38,0.40,0.42,0.45`. LFW is research-only and is
not in the repo.

**Throughput (1 x86 core):** 1.24 photos/s for 24 MP JPEGs with a few faces; 0.96/s for dense group shots (~30 faces).
The worker runs one thread per core.

**Tests:** 19 unit tests (geometry, NMS, tiling, clustering, ranking, EXIF, blurhash, selfie errors, checksum
tampering) + 4 integration tests against Postgres/S3 (idempotent re-processing, dedupe, event scoping, permanent
failures, expiry hard-delete).

**Costs:** none.
