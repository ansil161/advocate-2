"""Short-term conversation memory.

The assistant needs enough history for "tell me more about banking" to mean
something, and no more. Three bounds enforce that, and all three matter:

* **turns** — only the last ``CHAT_HISTORY_TURNS`` exchanges are replayed, so a
  long conversation costs the same per request as a short one;
* **age** — a conversation is forgotten after ``CHAT_CONVERSATION_TTL_SECONDS``,
  because what someone asked a law firm's website an hour ago is not something
  to keep sitting in memory;
* **count** — the in-process store holds a fixed maximum and evicts the least
  recently used, so a stream of new conversation ids cannot grow the process
  until it dies.

**Two backends, one interface.** With Redis a conversation survives whichever
worker answers the next message, and expiry is Redis's own TTL rather than a
timestamp this code has to check. Without it, memory is per-process — so a
visitor whose second message lands on a different worker is met by an assistant
that has forgotten them. That is the concrete cost of running more than one
worker without Redis, and it is why ``/health`` reports which backend is live.

Nothing is persisted beyond the TTL in either mode. A visitor's questions to a
law firm are not something to keep, and Redis is configured as a cache here,
not a database.
"""

from __future__ import annotations

import json
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any

from app.core.config import Settings
from app.core.logging import get_logger

log = get_logger(__name__)

# Chosen so a busy day of unique visitors stays comfortably inside a few
# megabytes: each entry is at most CHAT_HISTORY_TURNS × 2 short strings.
MAX_CONVERSATIONS = 2000


@dataclass
class _Conversation:
    # Flat list of {"role", "content"} in chat order, as the model wants it.
    turns: list[dict[str, str]] = field(default_factory=list)
    updated_at: float = field(default_factory=time.monotonic)


class ConversationStore:
    """In-process memory. The fallback when Redis is absent."""

    backend = "in-process"

    def __init__(self, settings: Settings, max_conversations: int = MAX_CONVERSATIONS) -> None:
        self._settings = settings
        self._max = max_conversations
        self._items: OrderedDict[str, _Conversation] = OrderedDict()

    async def history(self, conversation_id: str | None) -> list[dict[str, str]]:
        """The turns to replay, or an empty list for a new or expired thread."""
        if not conversation_id:
            return []
        entry = self._items.get(conversation_id)
        if entry is None:
            return []
        if self._expired(entry):
            del self._items[conversation_id]
            return []

        self._items.move_to_end(conversation_id)
        # Two messages per exchange, trimmed from the front so the most recent
        # turns are the ones that survive.
        limit = self._settings.chat_history_turns * 2
        return list(entry.turns[-limit:]) if limit else []

    async def record(self, conversation_id: str, question: str, answer: str) -> None:
        """Append one exchange, trimming and evicting as needed."""
        if not conversation_id:
            return

        entry = self._items.get(conversation_id)
        if entry is None or self._expired(entry):
            entry = _Conversation()
        entry.turns.append({"role": "user", "content": question})
        entry.turns.append({"role": "assistant", "content": answer})

        # Trimmed on write as well as on read, so a long-running conversation
        # never holds more than the window in memory.
        limit = max(self._settings.chat_history_turns * 2, 2)
        entry.turns = entry.turns[-limit:]
        entry.updated_at = time.monotonic()

        self._items[conversation_id] = entry
        self._items.move_to_end(conversation_id)
        self._evict()

    async def forget(self, conversation_id: str) -> None:
        self._items.pop(conversation_id, None)

    def __len__(self) -> int:
        return len(self._items)

    def _expired(self, entry: _Conversation) -> bool:
        return (time.monotonic() - entry.updated_at) > self._settings.chat_conversation_ttl_seconds

    def _evict(self) -> None:
        # Expired entries first — they are free to drop and doing so usually
        # avoids evicting a live conversation.
        for key in [k for k, v in self._items.items() if self._expired(v)]:
            del self._items[key]
        while len(self._items) > self._max:
            self._items.popitem(last=False)


class RedisConversationStore:
    """Conversation memory in Redis, shared across workers.

    No eviction logic and no expiry checks: every write sets a TTL, so Redis
    forgets a thread on exactly the schedule the settings describe. The
    ``MAX_CONVERSATIONS`` bound is unnecessary here too — Redis is deployed with
    a memory cap and an LRU policy, which is a better answer than a counter in
    application code.
    """

    backend = "redis"

    _KEY = "conv:{id}"

    def __init__(self, settings: Settings, redis: Any) -> None:
        self._settings = settings
        self._redis = redis

    async def history(self, conversation_id: str | None) -> list[dict[str, str]]:
        if not conversation_id:
            return []
        try:
            raw = await self._redis.get(self._KEY.format(id=conversation_id))
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "redis conversation read failed, continuing without history",
                extra={"event": "memory_degraded", "reason": type(exc).__name__},
            )
            return []
        if not raw:
            return []

        try:
            turns = json.loads(raw)
        except ValueError:
            # A malformed entry is treated as no history rather than as an
            # error: the conversation simply starts again, which is the same
            # outcome an expired thread produces.
            return []

        limit = self._settings.chat_history_turns * 2
        return list(turns[-limit:]) if limit else []

    async def record(self, conversation_id: str, question: str, answer: str) -> None:
        if not conversation_id:
            return

        turns = await self.history(conversation_id)
        turns = list(turns)
        turns.append({"role": "user", "content": question})
        turns.append({"role": "assistant", "content": answer})
        limit = max(self._settings.chat_history_turns * 2, 2)
        turns = turns[-limit:]

        try:
            # SET with an expiry, not SET then EXPIRE: one round trip, and no
            # window in which a conversation exists without a TTL and would
            # outlive the hour it is allowed.
            await self._redis.set(
                self._KEY.format(id=conversation_id),
                json.dumps(turns, ensure_ascii=False),
                ex=self._settings.chat_conversation_ttl_seconds,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "redis conversation write failed, this turn will not be remembered",
                extra={"event": "memory_degraded", "reason": type(exc).__name__},
            )

    async def forget(self, conversation_id: str) -> None:
        try:
            await self._redis.delete(self._KEY.format(id=conversation_id))
        except Exception:  # noqa: BLE001 - forgetting is best-effort
            pass


def build_conversation_store(settings: Settings, redis: Any | None):
    """Pick the backend. One place, so the choice cannot be made twice."""
    return RedisConversationStore(settings, redis) if redis is not None else ConversationStore(settings)
