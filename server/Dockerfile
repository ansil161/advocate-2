# SLA Advocates — Django backend and Celery worker.
#
# One image, two roles. The web process and the worker run the same code and the
# same settings; only the command differs. Building them separately would give
# two images that can drift, and a worker running different code from the app
# that queued its tasks is a genuinely confusing failure.
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

# libpq for psycopg2 at runtime. The -binary wheel bundles its own libpq, so no
# build toolchain is needed — which is why this stays a single-stage image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY sla ./sla

RUN useradd --create-home --uid 10002 sla && chown -R sla:sla /srv
USER sla

WORKDIR /srv/sla

EXPOSE 8000

# Gunicorn, not runserver: runserver is single-threaded, reloads on file changes
# and is explicitly not for production.
#
# 3 workers × 2 threads is sized for an admin panel used by a handful of staff,
# not for public traffic — the public site never touches Django.
CMD ["gunicorn", "sla.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--threads", "2", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
