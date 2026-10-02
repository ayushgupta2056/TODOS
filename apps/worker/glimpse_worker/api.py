"""Worker HTTP API.

POST /v1/selfie/embed  - selfie bytes -> embedding. In memory only: the request body is never
                         written to disk, storage or logs, and is dropped when the request ends.
GET  /healthz
"""

from __future__ import annotations

import asyncio
import hmac
import os
import threading
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from glimpse_worker.config import get_settings
from glimpse_worker.engine import get_engine
from glimpse_worker.pipeline import SelfieError, embed_selfie

MAX_SELFIE_BYTES = 8 * 1024 * 1024

# The engine keeps one model pair per thread (~90 MB). Selfies get a single dedicated thread, so
# a burst of guests can't load dozens of copies and push a 512 MB host out of memory.
_SELFIE_POOL = ThreadPoolExecutor(max_workers=1, thread_name_prefix="selfie")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_engine()  # load models at boot
    stop = threading.Event()
    if os.environ.get("GLIMPSE_START_CONSUMER") == "1":
        from glimpse_worker.queue import run_consumer

        threading.Thread(target=run_consumer, args=(stop,), daemon=True, name="queue").start()
    yield
    stop.set()


app = FastAPI(title="glimpse-worker", lifespan=lifespan, docs_url=None, redoc_url=None)


def _auth(token: str | None) -> None:
    expected = get_settings().worker_token
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "engine": get_engine().version}


@app.post("/v1/selfie/embed")
async def selfie_embed(
    request: Request, x_worker_token: str | None = Header(default=None)
) -> JSONResponse:
    _auth(x_worker_token)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_SELFIE_BYTES:
            raise HTTPException(status_code=413, detail="selfie too large")
    engine = get_engine()
    try:
        result = await asyncio.get_running_loop().run_in_executor(
            _SELFIE_POOL, embed_selfie, bytes(body), engine, get_settings()
        )
    except SelfieError as e:
        return JSONResponse({"ok": False, "code": e.code, "message": e.message}, status_code=422)
    finally:
        body.clear()
    return JSONResponse(
        {
            "ok": True,
            "engine_version": engine.version,
            "embedding": [round(float(v), 7) for v in result.embedding],
        },
        headers={"Cache-Control": "no-store"},
    )
