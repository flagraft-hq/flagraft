import email.utils
import json
import logging
import math
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from email.message import Message
from types import TracebackType
from typing import Any, cast
from urllib.parse import quote, urlencode, urlsplit

from . import _clock
from ._cache import TtlCache, make_key, stringify
from ._constants import (
    BULK_CACHE_KEY,
    DEFAULT_BACKOFF_SECONDS,
    DEFAULT_STALE_TTL_SECONDS,
    DEFAULT_TIMEOUT_SECONDS,
    DEFAULT_TTL_SECONDS,
    MAX_BACKOFF_SECONDS,
    MISSING_TTL_SECONDS,
    NOT_MODIFIED_STATUS,
    RATE_LIMIT_STATUS,
)
from ._types import Context, EvaluationResult, Feature, StaleEvent
from .errors import FlagraftError

logger = logging.getLogger("flagraft")


@dataclass(frozen=True)
class _Response:
    status: int
    headers: Message
    body: bytes


@dataclass(frozen=True)
class _BulkEntry:
    """Body and ETag kept together, so we never revalidate against a tag whose body is gone."""

    features: list[Feature]
    etag: str | None


def _is_caller_error(status_code: int) -> bool:
    """A misconfiguration worth raising; 5xx and 429 are outages to ride out instead."""
    return 400 <= status_code < 500 and status_code != RATE_LIMIT_STATUS


def _error_from(status: int, reason: str, body: bytes) -> FlagraftError:
    try:
        data: Any = json.loads(body)
    except ValueError:
        data = None
    if not isinstance(data, dict):
        data = {}
    message = str(data.get("message") or reason)
    return FlagraftError(message, status, str(data.get("error") or "HttpError"))


def _copy_features(features: list[Feature]) -> list[Feature]:
    return [Feature(name=f["name"], enabled=f["enabled"]) for f in features]


def _find_in_bulk(features: list[Feature], flag_key: str) -> bool | None:
    return next((f["enabled"] for f in features if f["name"] == flag_key), None)


def _parse_retry_after(header: str | None) -> float:
    """Seconds or an HTTP date; anything unusable means a short pause, and it is always capped."""
    value = (header or "").strip()
    if not value:
        return DEFAULT_BACKOFF_SECONDS
    try:
        seconds = float(value)
    except ValueError:
        try:
            at = email.utils.parsedate_to_datetime(value)
            seconds = at.replace(tzinfo=at.tzinfo or UTC).timestamp() - _clock.now()
        except (TypeError, ValueError):
            return DEFAULT_BACKOFF_SECONDS
    if not math.isfinite(seconds):
        return DEFAULT_BACKOFF_SECONDS
    return min(MAX_BACKOFF_SECONDS, max(0.0, seconds))


def _query_string(context: Context) -> str:
    if not context:
        return ""
    return "?" + urlencode({k: stringify(v) for k, v in context.items()})


class _SameOriginRedirects(urllib.request.HTTPRedirectHandler):
    """Follows redirects but never forwards the API key to a different origin."""

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None and urlsplit(newurl)[:2] != urlsplit(req.full_url)[:2]:
            new.remove_header("Authorization")
        return new


class FlagraftClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        ttl: float = DEFAULT_TTL_SECONDS,
        stale_ttl: float = DEFAULT_STALE_TTL_SECONDS,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        on_stale: Callable[[StaleEvent], None] | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout = max(0.0, timeout)
        self._on_stale = on_stale
        self._opener = urllib.request.build_opener(_SameOriginRedirects)
        self._single: TtlCache[EvaluationResult] = TtlCache(ttl, stale_ttl)
        self._bulk: TtlCache[_BulkEntry] = TtlCache(ttl, stale_ttl)
        # ttl=0 means no SDK caching at all, so the negative cache goes too.
        self._missing: TtlCache[bool] = TtlCache(0 if ttl <= 0 else MISSING_TTL_SECONDS)
        # ponytail: plain float, assignment is atomic; no lock needed for a deadline.
        self._rate_limited_until = 0.0

    def __enter__(self) -> "FlagraftClient":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()

    def close(self) -> None:
        self._single.clear()
        self._bulk.clear()
        self._missing.clear()

    def is_enabled(
        self, flag_key: str, context: Context | None = None, default: bool = False
    ) -> bool:
        # Existence does not depend on context, so one entry covers every caller.
        if self._missing.get(flag_key):
            return default

        ctx: Context = context or {}
        cache_key = make_key(flag_key, ctx)
        cached = self._single.get(cache_key)
        if cached is not None:
            return cached["enabled"]

        bulk_key = make_key(BULK_CACHE_KEY, ctx)
        bulk = self._bulk.get(bulk_key)
        if bulk is not None:
            enabled = _find_in_bulk(bulk.features, flag_key)
            if enabled is not None:
                return enabled
            # Both endpoints read the same flag map, so absent here means a 404 there.
            self._missing.set(flag_key, True)
            return default

        try:
            result = self._fetch_single(flag_key, ctx)
        except Exception as error:
            if isinstance(error, FlagraftError) and error.status_code == 404:
                self._missing.set(flag_key, True)
                return default

            stale = self._single.get_stale(cache_key)
            if stale is not None:
                self._report_stale(flag_key, stale.stored_at)
                return stale.value["enabled"]

            stale_bulk = self._bulk.get_stale(bulk_key)
            if stale_bulk is not None:
                stale_enabled = _find_in_bulk(stale_bulk.value.features, flag_key)
                if stale_enabled is not None:
                    self._report_stale(flag_key, stale_bulk.stored_at)
                    return stale_enabled

            if isinstance(error, FlagraftError) and _is_caller_error(error.status_code):
                raise
            if not self._backing_off():
                logger.warning(
                    "flag evaluation failed for %s, defaulting to %s: %s", flag_key, default, error
                )
            return default

        self._single.set(cache_key, result)
        return result["enabled"]

    def get_features(self, context: Context | None = None) -> dict[str, bool]:
        return {f["name"]: f["enabled"] for f in self.get_all_features(context)}

    def get_all_features(self, context: Context | None = None) -> list[Feature]:
        ctx: Context = context or {}
        cache_key = make_key(BULK_CACHE_KEY, ctx)
        cached = self._bulk.get(cache_key)
        if cached is not None:
            return _copy_features(cached.features)

        # An expired entry still holds a usable body, so its ETag lets the server answer 304.
        previous = self._bulk.get_stale(cache_key)
        try:
            features, etag = self._fetch_all(ctx, previous.value.etag if previous else None)
        except Exception as error:
            stale = self._bulk.get_stale(cache_key)
            if stale is not None:
                self._report_stale(None, stale.stored_at)
                return _copy_features(stale.value.features)

            if isinstance(error, FlagraftError) and _is_caller_error(error.status_code):
                raise
            if not self._backing_off():
                logger.warning("bulk evaluation failed, returning empty list: %s", error)
            return []

        if features is None:
            assert previous is not None
            entry = _BulkEntry(previous.value.features, etag or previous.value.etag)
        else:
            entry = _BulkEntry(features, etag)
        self._bulk.set(cache_key, entry)
        return _copy_features(entry.features)

    def _report_stale(self, flag_key: str | None, stored_at: float) -> None:
        if self._on_stale is None:
            age = round(_clock.now() - stored_at)
            label = flag_key if flag_key is not None else "all features"
            logger.warning("serving stale value for %s (fetched %ds ago)", label, age)
            return
        try:
            self._on_stale(StaleEvent(flag_key, datetime.fromtimestamp(stored_at, UTC)))
        except Exception:
            logger.warning("on_stale callback raised", exc_info=True)

    def _backing_off(self) -> bool:
        return _clock.now() < self._rate_limited_until

    def _start_backoff(self, retry_after: str | None) -> None:
        seconds = _parse_retry_after(retry_after)
        self._rate_limited_until = _clock.now() + seconds
        logger.warning("rate limited, pausing requests for %ds", round(seconds))

    def _send(self, url: str, if_none_match: str | None = None) -> _Response:
        # Adding requests to a rate limiter only deepens the hole.
        if self._backing_off():
            raise FlagraftError(
                "Backing off after a rate limit", RATE_LIMIT_STATUS, "TooManyRequests"
            )
        headers = {"authorization": self._api_key, "accept": "application/json"}
        if if_none_match:
            headers["if-none-match"] = if_none_match
        request = urllib.request.Request(url, headers=headers)
        try:
            # urllib reads timeout=None as "wait forever", which is what timeout=0 means here.
            with self._opener.open(request, timeout=self._timeout or None) as response:
                return _Response(response.status, response.headers, response.read())
        except urllib.error.HTTPError as error:
            with error:
                body = error.read()
            # urllib raises on 304, but for a conditional request it is a success.
            if error.code == NOT_MODIFIED_STATUS:
                return _Response(error.code, error.headers, body)
            if error.code == RATE_LIMIT_STATUS:
                self._start_backoff(error.headers.get("retry-after"))
            raise _error_from(error.code, str(error.reason), body) from None

    def _fetch_single(self, flag_key: str, context: Context) -> EvaluationResult:
        path = f"/api/v1/client/features/{quote(flag_key, safe='')}"
        response = self._send(f"{self._base_url}{path}{_query_string(context)}")
        data = json.loads(response.body)
        if not isinstance(data, dict) or not isinstance(data.get("enabled"), bool):
            raise ValueError("unexpected evaluation response")
        return cast(EvaluationResult, data)

    def _fetch_all(
        self, context: Context, if_none_match: str | None
    ) -> tuple[list[Feature] | None, str | None]:
        """Returns (None, etag) on a 304, meaning the stored body still holds."""
        url = f"{self._base_url}/api/v1/client/features{_query_string(context)}"
        response = self._send(url, if_none_match)
        etag = response.headers.get("etag")
        if response.status == NOT_MODIFIED_STATUS:
            if if_none_match is None:
                raise ValueError("unexpected 304 without a conditional request")
            return None, etag
        data = json.loads(response.body)
        features = data.get("features") if isinstance(data, dict) else None
        if not isinstance(features, list) or not all(
            isinstance(f, dict)
            and isinstance(f.get("name"), str)
            and isinstance(f.get("enabled"), bool)
            for f in features
        ):
            raise ValueError("unexpected features response")
        return cast(list[Feature], features), etag
