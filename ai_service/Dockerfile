# SLA Advocates — AI service.
#
# python:3.13-slim rather than 3.14: every pinned dependency resolves to a
# prebuilt cp313 wheel on this image, so the build downloads rather than
# compiles. The code targets >=3.12 and the suite passes on both.
FROM python:3.13-slim AS base

# PYTHONDONTWRITEBYTECODE — the image is read-only in practice, so .pyc files
# are dead weight. PYTHONUNBUFFERED — without it, logs sit in a buffer and a
# container that dies takes its last words with it.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

# Dependencies before source, so editing a Python file does not invalidate the
# pip layer and re-download the world.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
# The generated corpus. Copied in rather than mounted so the image is a complete,
# runnable artefact — a container that starts with no knowledge base would answer
# every question with the "no information" fallback and look merely unhelpful
# rather than broken.
COPY data ./data

# Runs as a non-root user. This service takes text from the public internet and
# hands it to a model; there is no reason for that process to be able to write to
# its own code.
RUN useradd --create-home --uid 10001 sla && chown -R sla:sla /srv
USER sla

EXPOSE 8001

# The container reports its own readiness, so Compose can gate Django's start on
# this service actually being able to answer rather than merely having a PID.
# /api/health probes Qdrant live and returns "degraded" — still a 200 — when a
# fallback is active, which is the right signal: the assistant is serving.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/api/health', timeout=4).status==200 else 1)"

# One worker by default, and that is deliberate rather than conservative: with
# REDIS_URL set the rate limiter and conversation memory are shared and this can
# be raised freely. Without Redis, each worker keeps its own counters and the
# effective rate limit multiplies by the worker count.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
