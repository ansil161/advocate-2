"""Shared setup for the operational scripts.

Each script is a CLI over application code, so all three need the same two
things: the service root on ``sys.path`` (they are run as files, not as a
package), and a configured logger. Doing it once here keeps that boilerplate
out of the scripts themselves, which is what lets them stay thin enough to read
as "parse arguments, call the app, print the result".

Nothing in here is business logic, and nothing imports it from ``app/``.
"""

from __future__ import annotations

import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]

# Run as a script from anywhere, so the service root has to be importable.
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))


def bootstrap():
    """Load settings and configure logging. Returns the settings object."""
    from app.core.config import get_settings
    from app.core.logging import configure_logging

    settings = get_settings()
    configure_logging(settings.log_level)
    return settings
