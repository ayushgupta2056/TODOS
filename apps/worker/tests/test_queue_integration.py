"""Integration tests against the local stack (Supabase Postgres + S3). Skipped when unreachable.

pnpm db:start && pnpm stack:up   # then: uv run pytest
"""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import Iterator
from typing import Any

import numpy as np
import psycopg
import pytest

from glimpse_worker import storage
from glimpse_worker.config import Settings, get_settings
from glimpse_worker.db import vec_literal
from glimpse_worker.engine import l2_normalize
from glimpse_worker.queue import maintenance, run_one
from tests.test_core import FakeEngine, face, jpeg


def _reachable() -> bool:
    try:
        with psycopg.connect(get_settings().database_url, connect_timeout=2) as c:
            c.execute("select 1 from public.jobs limit 1")
        storage.ensure_bucket(["http://localhost:3000"])
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _reachable(), reason="local DB/S3 not running")


@pytest.fixture
def conn() -> Iterator[psycopg.Connection[Any]]:
    with psycopg.connect(get_settings().database_url) as c:
        # isolate from any other queued work
        c.execute("delete from public.jobs where status in ('queued', 'running')")
        c.commit()
        yield c


def _mk_event(conn: psycopg.Connection[Any]) -> tuple[str, str]:
    uid = str(uuid.uuid4())
    conn.execute(
        "insert into auth.users (id, email, aud, role) values (%s, %s, 'authenticated', 'authenticated')",
        (uid, f"{uid}@test.local"),
    )
    studio = conn.execute(
        "insert into public.studios (owner_id, name) values (%s, 'Test Studio') returning id",
        (uid,),
    ).fetchone()
    assert studio
    ev = conn.execute(
        "insert into public.events (studio_id, slug, name) values (%s, %s, 'Test') returning id",
        (studio[0], f"t-{uid[:8]}"),
    ).fetchone()
    assert ev
    conn.commit()
    return str(ev[0]), uid


def _upload(conn: psycopg.Connection[Any], event_id: str, data: bytes) -> str:
    key = f"events/{event_id}/original/{uuid.uuid4()}.jpg"
    storage.put_bytes(key, data, "image/jpeg")
    row = conn.execute(
        "select photo_id, created from public.register_photo(%s, %s, 'a.jpg', 'image/jpeg', %s, %s)",
        (event_id, key, len(data), hashlib.sha256(data).hexdigest()),
    ).fetchone()
    conn.commit()
    assert row
    return str(row[0])


def _drain(conn: psycopg.Connection[Any], eng: FakeEngine, s: Settings) -> None:
    conn.execute("update public.jobs set run_after = now() where status = 'queued'")
    conn.commit()
    while run_one(conn, eng, s):
        conn.execute("update public.jobs set run_after = now() where status = 'queued'")
        conn.commit()


def test_process_is_idempotent_and_dedupes(conn: psycopg.Connection[Any]) -> None:
    s = Settings(tiling="never", cluster_debounce_s=0)
    eng = FakeEngine([face(100, 100, eye=40), face(300, 100, eye=40), face(500, 100, eye=5)])
    event_id, _ = _mk_event(conn)
    data = jpeg()
    pid = _upload(conn, event_id, data)
    assert _upload(conn, event_id, data) == pid  # same sha256 -> same photo, no new job
    _drain(conn, eng, s)

    def counts() -> tuple[int, int]:
        r = conn.execute(
            "select count(*), count(*) filter (where quality = 'ok') from public.faces where photo_id = %s",
            (pid,),
        ).fetchone()
        assert r
        return int(r[0]), int(r[1])

    assert counts() == (3, 2)
    # re-run the same job: faces are replaced, not duplicated
    conn.execute(
        "insert into public.jobs (type, payload) values ('process_photo', jsonb_build_object('photo_id', %s::text))",
        (pid,),
    )
    conn.commit()
    _drain(conn, eng, s)
    assert counts() == (3, 2)
    ev = conn.execute(
        "select photo_count, processed_count, face_count from public.events where id = %s",
        (event_id,),
    ).fetchone()
    assert ev == (1, 1, 2)
    st = conn.execute(
        "select status, blurhash is not null from public.photos where id = %s", (pid,)
    ).fetchone()
    assert st == ("done", True)


def test_search_is_event_scoped(conn: psycopg.Connection[Any]) -> None:
    s = Settings(tiling="never", cluster_debounce_s=0)
    eng = FakeEngine([face(100, 100, eye=40)])
    ev_a, _ = _mk_event(conn)
    ev_b, _ = _mk_event(conn)
    _upload(conn, ev_a, jpeg(noise=True))
    _upload(conn, ev_b, jpeg(noise=True))
    _drain(conn, eng, s)
    q = np.zeros(128, np.float32)
    q[100] = 1.0
    q = l2_normalize(q)
    for ev in (ev_a, ev_b):
        rows = conn.execute(
            "select photo_id from public.search_event_faces(%s, %s::extensions.vector, 'fake/v1', 0.4, 0.55)",
            (ev, vec_literal(q)),
        ).fetchall()
        owners = conn.execute(
            "select distinct event_id from public.photos where id = any(%s::uuid[])",
            ([r[0] for r in rows],),
        ).fetchall()
        assert len(rows) == 1 and owners == [(uuid.UUID(ev),)]


def test_bad_image_fails_permanently(conn: psycopg.Connection[Any]) -> None:
    s = Settings(tiling="never")
    event_id, _ = _mk_event(conn)
    pid = _upload(conn, event_id, b"definitely not a jpeg")
    _drain(conn, FakeEngine([]), s)
    st = conn.execute("select status from public.photos where id = %s", (pid,)).fetchone()
    assert st == ("failed",)
    job = conn.execute(
        "select status, attempts from public.jobs where payload->>'photo_id' = %s", (pid,)
    ).fetchone()
    assert job == ("failed", 1)


def test_expiry_hard_deletes_everything(conn: psycopg.Connection[Any]) -> None:
    s = Settings(tiling="never", cluster_debounce_s=0)
    eng = FakeEngine([face(100, 100, eye=40)])
    event_id, _ = _mk_event(conn)
    _upload(conn, event_id, jpeg())
    _drain(conn, eng, s)
    conn.execute(
        "update public.events set expires_at = now() - interval '1 minute' where id = %s",
        (event_id,),
    )
    conn.commit()
    maintenance(conn, s)
    # embeddings are dropped at once, before files are purged
    f = conn.execute(
        "select count(*) from public.faces where event_id = %s", (event_id,)
    ).fetchone()
    assert f == (0,)
    _drain(conn, eng, s)
    for table in ("events", "photos", "faces", "clusters"):
        col = "id" if table == "events" else "event_id"
        n = conn.execute(
            f"select count(*) from public.{table} where {col} = %s", (event_id,)
        ).fetchone()
        assert n == (0,), table
    left = storage._client().list_objects_v2(
        Bucket=get_settings().s3_bucket, Prefix=f"events/{event_id}/"
    )
    assert left.get("KeyCount", 0) == 0
