# Multi-arch (amd64 + arm64 for the Oracle Always Free Ampere VM)
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY glimpse_worker ./glimpse_worker
RUN uv sync --frozen --no-dev
# Download + checksum-verify YuNet (MIT) and SFace (Apache-2.0) into the image.
RUN uv run glimpse-face models
RUN useradd --system --uid 10001 glimpse && chown -R glimpse /app
USER glimpse
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8787/healthz')"
CMD ["uv", "run", "--no-sync", "glimpse-face", "serve", "--consume", "--port", "8787"]
