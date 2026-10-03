import threading
from datetime import datetime, timedelta, timezone

import pytest
from conftest import Clock

from flagraft._cache import TtlCache, make_key, stringify


def test_make_key_is_stable_regardless_of_context_order() -> None:
    assert make_key("f", {"a": "1", "b": "2"}) == make_key("f", {"b": "2", "a": "1"})


def test_make_key_differentiates_flag_keys() -> None:
    assert make_key("a", {}) != make_key("b", {})


def test_stringify_matches_js_string() -> None:
    assert stringify(True) == "true"
    assert stringify(False) == "false"
    assert stringify(42) == "42"
    assert stringify(1.0) == "1"
    assert stringify(1.5) == "1.5"
    assert stringify("x") == "x"


def test_stringify_formats_datetimes_like_to_iso_string() -> None:
    aware = datetime(2026, 1, 2, 8, 34, 5, 678000, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    assert stringify(aware) == "2026-01-02T03:04:05.678Z"


def test_stringify_treats_naive_datetimes_as_utc() -> None:
    assert stringify(datetime(2026, 1, 2)) == "2026-01-02T00:00:00.000Z"


def test_returns_set_values_within_ttl(clock: Clock) -> None:
    cache: TtlCache[int] = TtlCache(10)
    cache.set("k", 1)
    clock.advance(9.9)
    assert cache.get("k") == 1


def test_returns_none_after_ttl_expires(clock: Clock) -> None:
    cache: TtlCache[int] = TtlCache(10)
    cache.set("k", 1)
    clock.advance(10)
    assert cache.get("k") is None


def test_ttl_zero_disables_the_cache() -> None:
    cache: TtlCache[int] = TtlCache(0)
    cache.set("k", 1)
    assert cache.get("k") is None
    assert len(cache) == 0


def test_clear_removes_all_entries() -> None:
    cache: TtlCache[int] = TtlCache(10)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.clear()
    assert len(cache) == 0


def test_never_grows_past_max_entries() -> None:
    cache: TtlCache[int] = TtlCache(60, max_entries=3)
    for i in range(10):
        cache.set(str(i), i)
    assert len(cache) == 3


def test_drops_the_oldest_entry_first() -> None:
    cache: TtlCache[int] = TtlCache(60, max_entries=3)
    for key in "abcd":
        cache.set(key, 1)
    assert cache.get("a") is None
    assert cache.get("b") == 1


def test_treats_a_refreshed_key_as_the_newest_again() -> None:
    cache: TtlCache[int] = TtlCache(60, max_entries=3)
    for key in "abc":
        cache.set(key, 1)
    cache.set("a", 2)
    cache.set("d", 1)
    assert cache.get("a") == 2
    assert cache.get("b") is None


def test_get_stale_returns_an_expired_value_inside_the_window(clock: Clock) -> None:
    cache: TtlCache[int] = TtlCache(10, stale_ttl=20)
    cache.set("k", 1)
    clock.advance(15)
    assert cache.get("k") is None
    hit = cache.get_stale("k")
    assert hit is not None and hit.value == 1


def test_get_stale_reports_when_the_value_was_stored(clock: Clock) -> None:
    cache: TtlCache[int] = TtlCache(10, stale_ttl=20)
    stored_at = clock.now
    cache.set("k", 1)
    clock.advance(15)
    hit = cache.get_stale("k")
    assert hit is not None and hit.stored_at == stored_at


def test_get_stale_ignores_a_fresh_value() -> None:
    cache: TtlCache[int] = TtlCache(10, stale_ttl=20)
    cache.set("k", 1)
    assert cache.get_stale("k") is None


def test_drops_the_value_once_the_stale_window_closes(clock: Clock) -> None:
    cache: TtlCache[int] = TtlCache(10, stale_ttl=20)
    cache.set("k", 1)
    clock.advance(30)
    assert cache.get_stale("k") is None
    assert len(cache) == 0


def test_keeps_no_stale_value_when_stale_ttl_is_zero(clock: Clock) -> None:
    cache: TtlCache[int] = TtlCache(10)
    cache.set("k", 1)
    clock.advance(10)
    assert cache.get_stale("k") is None


def test_cap_holds_under_concurrent_writers() -> None:
    cache: TtlCache[int] = TtlCache(60, max_entries=100)

    def write(prefix: int) -> None:
        for i in range(1000):
            cache.set(f"{prefix}-{i}", i)

    threads = [threading.Thread(target=write, args=(n,)) for n in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert len(cache) == 100


def test_stringify_zero_pads_early_years() -> None:
    assert stringify(datetime(5, 1, 1)) == "0005-01-01T00:00:00.000Z"


JS_NUMBER_STRINGS = [
    (1e-6, "0.000001"),
    (1e-7, "1e-7"),
    (1.5e-7, "1.5e-7"),
    (-1e-7, "-1e-7"),
    (123.456, "123.456"),
    (1e21, "1e+21"),
    (1.5e21, "1.5e+21"),
    (1e20, "100000000000000000000"),
    (-0.0, "0"),
    (float("nan"), "NaN"),
    (float("inf"), "Infinity"),
    (float("-inf"), "-Infinity"),
    (0.1 + 0.2, "0.30000000000000004"),
    (1.0, "1"),
    (1.5, "1.5"),
    (123e-20, "1.23e-18"),
    (0.000123, "0.000123"),
    (-2.5e-5, "-0.000025"),
    (5e-324, "5e-324"),
    (1.7976931348623157e308, "1.7976931348623157e+308"),
]


@pytest.mark.parametrize(("value", "expected"), JS_NUMBER_STRINGS)
def test_stringify_formats_floats_like_js(value: float, expected: str) -> None:
    assert stringify(value) == expected
