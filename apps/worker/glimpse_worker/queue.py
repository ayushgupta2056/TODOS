"""Postgres job queue consumer (`SELECT ... FOR UPDATE SKIP LOCKED`, no Redis).

Jobs are idempotent: re-running `process_photo` replaces that photo's faces in one transaction,
`cluster_event` rebuilds the event's clusters from scratch, and `delete_event` can be retried
until nothing is left.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import socket
import threading
import time
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import numpy as np
from psycopg import Connection
from psycopg.rows import dict_row

from glimpse_worker import storage
from glimpse_worker.cluster import cluster_embeddings
from glimpse_worker.config import Settings, get_settings
from glimpse_worker.db import parse_vec, pool, vec_literal
from glimpse_worker.engine import FaceEngine, get_engine
from glimpse_worker.imageops import ImageDecodeError, decode, watermark, webp_bytes
from glimpse_worker.pipeline import process_photo_bytes

log = logging.getLogger("glimpse.queue")
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"


class PermanentError(Exception):
    """Retrying won't help (e.g. the file is not an image)."""


@dataclass(frozen=True, slots=True)
class Job:
    id: int
    type: str
    payload: dict[str, Any]
    attempts: int
    max_attempts: int


# --- claiming ---------------------------------------------------------------------------------


def claim(conn: Connection[Any]) -> Job | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            update public.jobs j set status = 'running', locked_at = now(), locked_by = %s,
                   attempts = j.attempts + 1
            where j.id = (
              select id from public.jobs
              where status = 'queued' and run_after <= now()
              order by run_after, id
              for update skip locked
              limit 1
            )
            returning j.id, j.type, j.payload, j.attempts, j.max_attempts
            """,
            (WORKER_ID,),
        )
        row = cur.fetchone()
    conn.commit()
    if row is None:
        return None
    return Job(row["id"], row["type"], row["payload"], row["attempts"], row["max_attempts"])


def finish(conn: Connection[Any], job: Job) -> None:
    conn.execute(
        "update public.jobs set status = 'done', finished_at = now(), locked_at = null "
        "where id = %s",
        (job.id,),
    )
    conn.commit()


def fail(conn: Connection[Any], job: Job, err: str, permanent: bool) -> bool:
    """Returns True if the job is now permanently failed."""
    final = permanent or job.attempts >= job.max_attempts
    if final:
        conn.execute(
            "update public.jobs set status = 'failed', last_error = %s, finished_at = now(), "
            "locked_at = null where id = %s",
            (err[:2000], job.id),
        )
    else:
        backoff = min(3600, 10 * 2 ** (job.attempts - 1))
        conn.execute(
            "update public.jobs set status = 'queued', last_error = %s, locked_at = null, "
            "run_after = now() + make_interval(secs => %s) where id = %s",
            (err[:2000], backoff, job.id),
        )
    conn.commit()
    return final


def enqueue_cluster(conn: Connection[Any], event_id: str, debounce_s: int) -> None:
    """Debounced: at most one queued cluster job per event. Each new photo pushes it back a
    little, but never more than 2 minutes after the first request."""
    conn.execute(
        """
        insert into public.jobs (type, payload, run_after, dedupe_key)
        values ('cluster_event', jsonb_build_object('event_id', %s::text),
                now() + make_interval(secs => %s), 'cluster:' || %s::text)
        on conflict (dedupe_key) where status = 'queued'
        do update set run_after =
          least(excluded.run_after, public.jobs.created_at + interval '2 minutes')
        """,
        (event_id, debounce_s, event_id),
    )


# --- handlers ---------------------------------------------------------------------------------


def _keys(event_id: str, photo_id: str) -> dict[str, str]:
    base = f"events/{event_id}"
    return {
        "web": f"{base}/web/{photo_id}.webp",
        "web_wm": f"{base}/web-wm/{photo_id}.webp",
        "thumb": f"{base}/thumb/{photo_id}.webp",
    }


def handle_process_photo(conn: Connection[Any], job: Job, engine: FaceEngine, s: Settings) -> None:
    photo_id = str(job.payload["photo_id"])
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select p.id, p.event_id, p.studio_id, p.r2_key_original, e.watermark,
                   e.status as event_status,
                   st.name as studio_name
            from public.photos p
            join public.events e on e.id = p.event_id
            join public.studios st on st.id = p.studio_id
            where p.id = %s
            """,
            (photo_id,),
        )
        row = cur.fetchone()
    if row is None or row["event_status"] == "deleting":
        conn.rollback()
        return  # photo or event deleted meanwhile: nothing to do
    event_id = str(row["event_id"])
    conn.execute("update public.photos set status = 'processing' where id = %s", (photo_id,))
    conn.commit()

    data = storage.get_bytes(row["r2_key_original"])
    try:
        result = process_photo_bytes(
            data, engine, s, watermark_text=row["studio_name"] if row["watermark"] else None
        )
    except ImageDecodeError as exc:
        raise PermanentError(str(exc)) from exc

    keys = _keys(event_id, photo_id)
    storage.put_bytes(keys["web"], result.web, "image/webp")
    storage.put_bytes(keys["thumb"], result.thumb, "image/webp")
    if result.web_watermarked is not None:
        storage.put_bytes(keys["web_wm"], result.web_watermarked, "image/webp")

    face_rows = [
        (
            photo_id,
            event_id,
            list(f.bbox),
            [c for p in f.landmarks for c in p],
            f.det_score,
            f.blur_score,
            f.quality,
            vec_literal(f.embedding) if f.embedding is not None else None,
            engine.version,
        )
        for f in result.faces
    ]
    n_ok = len(result.embedded_faces)
    with conn.transaction():
        conn.execute("delete from public.faces where photo_id = %s", (photo_id,))
        if face_rows:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    insert into public.faces (photo_id, event_id, bbox, landmarks, det_score,
                                              blur_score, quality, embedding, engine_version)
                    values (%s, %s, %s, %s, %s, %s, %s, %s::extensions.vector, %s)
                    """,
                    face_rows,
                )
        conn.execute(
            """
            update public.photos set
              status = %s, error = null, width = %s, height = %s, taken_at = coalesce(taken_at, %s),
              blurhash = %s, r2_key_web = %s, r2_key_thumb = %s, r2_key_web_wm = %s,
              face_count = %s, processed_at = now()
            where id = %s
            """,
            (
                "done" if n_ok else "no_faces",
                result.width,
                result.height,
                result.taken_at,
                result.blurhash,
                keys["web"],
                keys["thumb"],
                keys["web_wm"] if result.web_watermarked is not None else None,
                n_ok,
                photo_id,
            ),
        )
        conn.execute(
            """
            insert into public.usage (studio_id, month, photos_processed)
            values (%s, date_trunc('month', now())::date, 1)
            on conflict (studio_id, month)
            do update set photos_processed = public.usage.photos_processed + 1
            """,
            (row["studio_id"],),
        )
        if n_ok:
            enqueue_cluster(conn, event_id, s.cluster_debounce_s)
        conn.execute("select public.refresh_event_stats(%s)", (event_id,))


def handle_cluster_event(conn: Connection[Any], job: Job, engine: FaceEngine, s: Settings) -> None:
    event_id = str(job.payload["event_id"])
    with conn.cursor() as cur:
        cur.execute(
            "select id, embedding::text from public.faces "
            "where event_id = %s and embedding is not null and engine_version = %s order by id",
            (event_id, engine.version),
        )
        rows = cur.fetchall()
    ids = [str(r[0]) for r in rows]
    x = (
        np.stack([parse_vec(r[1]) for r in rows])
        if rows
        else np.zeros((0, engine.embedding_dim), np.float32)
    )
    clusters = cluster_embeddings(x, s.cluster_threshold, s.cluster_min_samples)
    with conn.transaction():
        conn.execute("update public.faces set cluster_id = null where event_id = %s", (event_id,))
        conn.execute("delete from public.clusters where event_id = %s", (event_id,))
        face_ids: list[str] = []
        cluster_ids: list[str] = []
        for c in clusters:
            cur = conn.execute(
                """
                insert into public.clusters
                  (event_id, representative_face_id, size, centroid, engine_version)
                values (%s, %s, %s, %s::extensions.vector, %s) returning id
                """,
                (
                    event_id,
                    ids[c.representative],
                    len(c.members),
                    vec_literal(c.centroid),
                    engine.version,
                ),
            )
            got = cur.fetchone()
            assert got is not None
            cid = str(got[0])
            for m in c.members:
                face_ids.append(ids[m])
                cluster_ids.append(cid)
        if face_ids:
            conn.execute(
                """
                update public.faces f set cluster_id = u.cid
                from unnest(%s::uuid[], %s::uuid[]) as u(fid, cid)
                where f.id = u.fid
                """,
                (face_ids, cluster_ids),
            )
        conn.execute("select public.refresh_event_stats(%s)", (event_id,))


def handle_delete_event(conn: Connection[Any], job: Job, _e: FaceEngine, _s: Settings) -> None:
    """Hard delete: all objects under the event prefix, then every row (faces, clusters, photos,
    guest sessions cascade from events)."""
    event_id = str(job.payload["event_id"])
    storage.delete_prefix(f"events/{event_id}/")
    with conn.transaction():
        cur = conn.execute(
            "delete from public.events where id = %s returning studio_id", (event_id,)
        )
        got = cur.fetchone()
        conn.execute(
            "insert into public.audit_log (studio_id, event_id, actor, action, detail) "
            "values (%s, %s, 'worker', 'event.hard_deleted', %s::jsonb)",
            (got[0] if got else None, event_id, json.dumps({"reason": job.payload.get("reason")})),
        )


def handle_rewatermark_event(conn: Connection[Any], job: Job, _e: FaceEngine, s: Settings) -> None:
    event_id = str(job.payload["event_id"])
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select e.watermark, st.name from public.events e join public.studios st "
            "on st.id = e.studio_id where e.id = %s",
            (event_id,),
        )
        ev = cur.fetchone()
        if ev is None or not ev["watermark"]:
            conn.rollback()
            return
        cur.execute(
            "select id, r2_key_web from public.photos where event_id = %s and status = 'done' "
            "and r2_key_web is not null and r2_key_web_wm is null",
            (event_id,),
        )
        photos = cur.fetchall()
    conn.commit()
    for p in photos:
        web = decode(storage.get_bytes(p["r2_key_web"])).pil
        key = _keys(event_id, str(p["id"]))["web_wm"]
        storage.put_bytes(key, webp_bytes(watermark(web, ev["name"]), s.web_quality), "image/webp")
        conn.execute("update public.photos set r2_key_web_wm = %s where id = %s", (key, p["id"]))
        conn.commit()


HANDLERS: dict[str, Callable[[Connection[Any], Job, FaceEngine, Settings], None]] = {
    "process_photo": handle_process_photo,
    "cluster_event": handle_cluster_event,
    "delete_event": handle_delete_event,
    "rewatermark_event": handle_rewatermark_event,
}


def _mark_photo_failed(conn: Connection[Any], job: Job, err: str) -> None:
    if job.type == "process_photo":
        conn.execute(
            "update public.photos set status = 'failed', error = %s where id = %s",
            (err[:500], job.payload.get("photo_id")),
        )
        conn.execute(
            "select public.refresh_event_stats(event_id) from public.photos where id = %s",
            (job.payload.get("photo_id"),),
        )
        conn.commit()


def run_one(conn: Connection[Any], engine: FaceEngine, s: Settings) -> bool:
    """Claim and run one job. Returns False if the queue was empty."""
    job = claim(conn)
    if job is None:
        return False
    handler = HANDLERS.get(job.type)
    try:
        if handler is None:
            raise PermanentError(f"unknown job type {job.type}")
        handler(conn, job, engine, s)
        conn.commit()
        finish(conn, job)
    except Exception as exc:
        conn.rollback()
        permanent = isinstance(exc, PermanentError)
        log.warning("job %s (%s) failed: %s", job.id, job.type, exc)
        if fail(conn, job, f"{type(exc).__name__}: {exc}", permanent):
            _mark_photo_failed(conn, job, str(exc))
    return True


# --- maintenance (Phase 7 ops) -----------------------------------------------------------------


def maintenance(conn: Connection[Any], s: Settings) -> None:
    # 1. crashed workers: requeue jobs whose lock is stale
    conn.execute(
        "update public.jobs set status = 'queued', locked_at = null "
        "where status = 'running' and locked_at < now() - make_interval(secs => %s)",
        (s.lock_timeout_s,),
    )
    # 2. expired events: hide immediately, drop embeddings now, purge files + rows via job
    conn.execute(
        """
        with expired as (
          update public.events set status = 'deleting'
          where expires_at is not null and expires_at <= now() and status <> 'deleting'
          returning id
        ), gone as (
          delete from public.faces where event_id in (select id from expired)
        )
        insert into public.jobs (type, payload, dedupe_key)
        select 'delete_event', jsonb_build_object('event_id', id::text, 'reason', 'expired'),
               'delete:' || id::text
        from expired
        on conflict do nothing
        """
    )
    # 3. guest ZIP lists are temporary
    conn.execute(
        "update public.guest_sessions set matched_photo_ids = null "
        "where matched_photo_ids is not null and matches_expire_at <= now()"
    )
    # 4. finished jobs older than 7 days
    conn.execute(
        "delete from public.jobs where status = 'done' and finished_at < now() - interval '7 days'"
    )
    conn.commit()


def has_pending_work() -> bool:
    with pool().connection() as conn:
        row = conn.execute(
            "select exists (select 1 from public.jobs where status in ('queued', 'running'))"
        ).fetchone()
        conn.rollback()
    return bool(row and row[0])


# --- runner -----------------------------------------------------------------------------------


def run_consumer(stop: threading.Event | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    s = get_settings()
    engine = get_engine()
    stop = stop or threading.Event()
    if threading.current_thread() is threading.main_thread():
        signal.signal(signal.SIGTERM, lambda *_: stop.set())
        signal.signal(signal.SIGINT, lambda *_: stop.set())

    def loop() -> None:
        while not stop.is_set():
            try:
                with pool().connection() as conn:
                    while not stop.is_set() and run_one(conn, engine, s):
                        pass
            except Exception:
                log.exception("consumer loop error")
            stop.wait(s.poll_interval_s)

    def maint() -> None:
        while not stop.is_set():
            try:
                with pool().connection() as conn:
                    maintenance(conn, s)
            except Exception:
                log.exception("maintenance error")
            stop.wait(60)

    def keepalive() -> None:
        url = s.keepalive_url.rstrip("/") + "/healthz"
        while not stop.wait(s.keepalive_every_s):
            try:
                if has_pending_work():
                    urllib.request.urlopen(url, timeout=30).close()  # our own public URL
            except Exception:
                log.warning("keep-alive ping failed", exc_info=True)

    threads = [
        threading.Thread(target=loop, name=f"consumer-{i}", daemon=True)
        for i in range(s.concurrency)
    ]
    threads.append(threading.Thread(target=maint, name="maintenance", daemon=True))
    if s.keepalive_url:
        threads.append(threading.Thread(target=keepalive, name="keepalive", daemon=True))
    for t in threads:
        t.start()
    log.info("consumer started: %d threads, engine %s", s.concurrency, engine.version)
    while not stop.is_set():
        time.sleep(0.5)
    for t in threads:
        t.join(timeout=30)
