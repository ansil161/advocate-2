"""Logging setup, and the rule about what must never enter a log record.

The service logs enough to answer the operational questions that matter — did
retrieval find anything, which model answered, how long each leg took, how
often the limiter fires — while treating the visitor's own words as something
it is holding in trust rather than something it owns.

What is never logged, anywhere in this package:

* the visitor's message text, or the assistant's answer text;
* the Hugging Face token, the Qdrant key, or any header carrying either;
* raw IP addresses (the rate limiter hashes them before they are ever used as
  a key, and the hash is what appears in a log line).

What *is* logged about a message is its shape: length, whether it retrieved
anything, the top similarity score, which fallback layer answered. That is
enough to debug a bad answer without keeping a transcript of what people
brought to a law firm.
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar

# Set per request by the middleware in main.py and read by the formatter, so a
# request's log lines can be tied together without every call site threading an
# id through its arguments.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

# The keys the formatter promotes to top level in JSON mode. Anything else a
# caller passes via `extra=` is dropped rather than logged, which stops a
# careless `extra={"message": user_text}` from becoming a transcript.
_ALLOWED_EXTRA = frozenset(
    {
        "event",
        "duration_ms",
        "chunks",
        "top_score",
        "model",
        "source",
        "status",
        "reason",
        "client_hash",
        "conversation",
        "message_chars",
        "collection",
    }
)


class _JsonFormatter(logging.Formatter):
    """One JSON object per line, for a log shipper to parse in production."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "request_id": request_id_var.get(),
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key in _ALLOWED_EXTRA:
                payload[key] = value
        if record.exc_info:
            # The type and message, not the traceback: a traceback in a log
            # aggregator is fine, but this keeps the line bounded.
            exc_type, exc_value, _ = record.exc_info
            payload["error"] = f"{getattr(exc_type, '__name__', 'Error')}: {exc_value}"
        return json.dumps(payload, ensure_ascii=False, default=str)


class _ConsoleFormatter(logging.Formatter):
    """Human-readable, for a developer watching a terminal."""

    def format(self, record: logging.LogRecord) -> str:
        base = f"{self.formatTime(record, '%H:%M:%S')} {record.levelname:<7} {record.name} · {record.getMessage()}"
        extras = " ".join(
            f"{key}={record.__dict__[key]}" for key in _ALLOWED_EXTRA if key in record.__dict__
        )
        line = f"{base}  {extras}".rstrip()
        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        return line


def configure_logging(level: str = "INFO", *, json_output: bool = False) -> None:
    """Install a single stdout handler on the root logger.

    Existing handlers are replaced rather than added to, so that repeated calls
    (a test importing the app factory more than once, uvicorn's own reload)
    cannot produce duplicated lines.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter() if json_output else _ConsoleFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    # uvicorn installs its own handlers; letting them propagate to ours would
    # print every access line twice in two different formats.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True

    # httpx logs the full request URL at INFO, which for this service means the
    # Qdrant cluster URL and the model path on every single call.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
