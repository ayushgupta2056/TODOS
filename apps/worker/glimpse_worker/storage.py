"""S3-compatible object storage (Cloudflare R2 in production, MinIO locally)."""

from __future__ import annotations

import contextlib
from functools import lru_cache
from typing import Any

import boto3
from botocore.config import Config

from glimpse_worker.config import get_settings


@lru_cache(maxsize=1)
def _client() -> Any:
    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint,
        region_name=s.s3_region,
        aws_access_key_id=s.s3_access_key_id,
        aws_secret_access_key=s.s3_secret_access_key,
        aws_session_token=s.s3_session_token or None,
        config=Config(
            # Some S3-compatible stores (Supabase) reject the newer default checksum headers.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 5, "mode": "standard"},
            max_pool_connections=64,
        ),
    )


def get_bytes(key: str) -> bytes:
    obj = _client().get_object(Bucket=get_settings().s3_bucket, Key=key)
    data: bytes = obj["Body"].read()
    return data


def put_bytes(key: str, data: bytes, content_type: str) -> None:
    _client().put_object(
        Bucket=get_settings().s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="private, max-age=31536000, immutable",
    )


def delete_prefix(prefix: str) -> int:
    """Hard-delete every object under `prefix`. Returns the number deleted."""
    c = _client()
    bucket = get_settings().s3_bucket
    n = 0
    token: str | None = None
    while True:
        kw: dict[str, Any] = {"Bucket": bucket, "Prefix": prefix, "MaxKeys": 1000}
        if token:
            kw["ContinuationToken"] = token
        page = c.list_objects_v2(**kw)
        keys = [{"Key": o["Key"]} for o in page.get("Contents", [])]
        if keys:
            try:
                c.delete_objects(Bucket=bucket, Delete={"Objects": keys, "Quiet": True})
            except Exception:
                # Not every S3-compatible store supports DeleteObjects (e.g. Supabase with
                # session-token auth): fall back to one request per object.
                for k in keys:
                    c.delete_object(Bucket=bucket, Key=k["Key"])
            n += len(keys)
        if not page.get("IsTruncated"):
            return n
        token = page.get("NextContinuationToken")


def ensure_bucket(cors_origins: list[str]) -> None:
    """Dev helper: create the bucket and set CORS so browsers can upload directly."""
    c = _client()
    bucket = get_settings().s3_bucket
    try:
        c.head_bucket(Bucket=bucket)
    except Exception:
        c.create_bucket(Bucket=bucket)
    # MinIO has no bucket-CORS API; there it is configured via MINIO_API_CORS_ALLOW_ORIGIN.
    with contextlib.suppress(Exception):
        _put_cors(c, bucket, cors_origins)


def _put_cors(c: Any, bucket: str, cors_origins: list[str]) -> None:
    c.put_bucket_cors(
        Bucket=bucket,
        CORSConfiguration={
            "CORSRules": [
                {
                    "AllowedOrigins": cors_origins,
                    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
                    "AllowedHeaders": ["*"],
                    "ExposeHeaders": ["ETag"],
                    "MaxAgeSeconds": 3600,
                }
            ]
        },
    )
