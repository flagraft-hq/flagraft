import json
import threading
from datetime import UTC, datetime
from typing import Generic, NamedTuple, TypeVar

from . import _clock
from ._constants import MAX_CACHE_ENTRIES
from ._types import Context, ContextValue

T = TypeVar("T")


def stringify(value: ContextValue) -> str:
    """Matches JavaScript's String(value) for realistic values; the server was built against it."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, datetime):
        utc = value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
        return utc.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def make_key(flag_key: str, context: Context) -> str:
    return flag_key + ":" + json.dumps({k: stringify(context[k]) for k in sorted(context)})


class StaleHit(NamedTuple, Generic[T]):
    value: T
    stored_at: float


class TtlCache(Generic[T]):
    def __init__(
        self, ttl: float, stale_ttl: float = 0, max_entries: int = MAX_CACHE_ENTRIES
    ) -> None:
        self._ttl = max(0.0, ttl)
        self._stale_ttl = max(0.0, stale_ttl)
        self._max_entries = min(MAX_CACHE_ENTRIES, max(1, max_entries))
        self._store: dict[str, tuple[T, float]] = {}
        # ponytail: one lock per cache, never held during HTTP; finer locks only if contention shows
        self._lock = threading.Lock()

    def __len__(self) -> int:
        return len(self._store)

    def _read(self, key: str) -> tuple[T, float, float] | None:
        if self._ttl == 0:
            return None
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, stored_at = entry
            age = _clock.now() - stored_at
            if age >= self._ttl + self._stale_ttl:
                del self._store[key]
                return None
        return value, stored_at, age

    def get(self, key: str) -> T | None:
        hit = self._read(key)
        if hit is None or hit[2] >= self._ttl:
            return None
        return hit[0]

    def get_stale(self, key: str) -> StaleHit[T] | None:
        hit = self._read(key)
        if hit is None or hit[2] < self._ttl:
            return None
        return StaleHit(hit[0], hit[1])

    def set(self, key: str, value: T) -> None:
        if self._ttl == 0:
            return
        with self._lock:
            # Re-inserting moves the key to the end, so a refreshed key is evicted last.
            self._store.pop(key, None)
            if len(self._store) >= self._max_entries:
                del self._store[next(iter(self._store))]
            self._store[key] = (value, _clock.now())

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
