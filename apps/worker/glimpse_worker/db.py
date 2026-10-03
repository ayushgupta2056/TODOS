"""Postgres access for the worker (direct connection; bypasses PostgREST)."""

from __future__ import annotations

from functools import lru_cache

import numpy as np
import numpy.typing as npt
from psycopg_pool import ConnectionPool

from glimpse_worker.config import get_settings


@lru_cache(maxsize=1)
def pool() -> ConnectionPool:
    s = get_settings()
    p = ConnectionPool(
        s.database_url,
        min_size=1,
        max_size=max(4, s.concurrency + 2),
        kwargs={"autocommit": False},
        open=True,
    )
    return p


def vec_literal(v: npt.NDArray[np.float32]) -> str:
    """pgvector text format. Avoids needing the pgvector Python adapter."""
    return "[" + ",".join(f"{float(x):.7g}" for x in v) + "]"


def parse_vec(text: str) -> npt.NDArray[np.float32]:
    return np.array([float(x) for x in text.strip("[]").split(",")], dtype=np.float32)
