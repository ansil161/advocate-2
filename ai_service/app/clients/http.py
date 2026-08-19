"""The retry policy both upstreams share.

Extracted so that Hugging Face and Gemini cannot drift apart on the one
question that matters here: *which failures are worth trying again*. Getting
that wrong in either direction is expensive — retrying a 401 wastes the
visitor's time on an outcome that cannot change, while not retrying a 503 makes
a serverless cold start look like an outage.

The split is by whether the fault is ours or theirs. A 4xx that is not 429 says
the request itself is wrong — bad key, unknown model, malformed body — and it
will be equally wrong on the second attempt, so it is raised immediately.
Everything in ``RETRY_STATUS`` is a capacity or transport problem that a short
wait genuinely fixes.
"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from app.core.logging import get_logger

log = get_logger(__name__)

# 429 provider-side rate limit, 5xx capacity and gateway faults, and 503 which
# is also Hugging Face's cold-start signal. Everything else — 400, 401, 403,
# 404, 422 — is a configuration fault and is raised on the first attempt.
RETRY_STATUS = frozenset({429, 500, 502, 503, 504})
MAX_ATTEMPTS = 3
BACKOFF_SECONDS = (1.0, 3.0)

# Provider error bodies can be long and can quote the request back. This string
# is destined for a log line and never for a response, but it is still trimmed:
# an unbounded upstream body in the logs is its own problem.
_MAX_DETAIL_CHARS = 200


async def post_json(
    client: httpx.AsyncClient,
    url: str,
    payload: dict[str, Any],
    *,
    headers: dict[str, str],
    timeout: float,
    failure: type[Exception],
    provider: str,
) -> Any:
    """POST with bounded retries, raising ``failure`` once attempts run out.

    ``failure`` is a parameter because callers want different signals from it:
    a failed embedding sends retrieval to its lexical fallback, a failed
    generation sends the chat service to its quote fallback.
    """
    last_detail = "no attempt made"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = await client.post(url, json=payload, headers=headers, timeout=timeout)
        except httpx.TimeoutException:
            last_detail = f"timeout after {timeout}s"
        except httpx.HTTPError as exc:
            last_detail = f"transport error: {type(exc).__name__}"
        else:
            if response.status_code < 400:
                try:
                    return response.json()
                except ValueError:
                    raise failure("upstream returned a non-JSON body") from None

            last_detail = f"HTTP {response.status_code}: {response.text[:_MAX_DETAIL_CHARS]}"
            if response.status_code not in RETRY_STATUS:
                raise failure(last_detail)

        if attempt < MAX_ATTEMPTS:
            delay = BACKOFF_SECONDS[min(attempt - 1, len(BACKOFF_SECONDS) - 1)]
            log.warning(
                "upstream call failed, retrying",
                extra={
                    "event": "upstream_retry",
                    "provider": provider,
                    "reason": last_detail,
                    "status": attempt,
                },
            )
            await asyncio.sleep(delay)

    raise failure(last_detail)
