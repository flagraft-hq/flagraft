import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from email.utils import formatdate

import pytest
from conftest import Clock
from fakes import BULK, FakeServer, Received, Reply, error, evaluation, feature_list, flag_path

from flagraft import FlagraftClient, FlagraftError, StaleEvent

MakeClient = Callable[..., FlagraftClient]
UNREACHABLE = "http://127.0.0.1:1"


class TestIsEnabled:
    def test_returns_true_when_server_reports_enabled(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("new-checkout"), evaluation("new-checkout", True))
        assert make_client().is_enabled("new-checkout") is True

    def test_sends_the_raw_api_key_as_authorization(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        make_client().is_enabled("f")
        assert server.requests[0].headers["authorization"] == "client-key"

    def test_strips_trailing_slashes_from_base_url(self, server: FakeServer) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        assert FlagraftClient(server.url + "//", "client-key").is_enabled("f") is True

    def test_encodes_the_flag_key_in_the_path(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("a/b c"), evaluation("a/b c", True))
        assert make_client().is_enabled("a/b c") is True

    def test_returns_false_on_network_failure_without_raising(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        assert FlagraftClient(UNREACHABLE, "k").is_enabled("f") is False
        assert "flag evaluation failed" in caplog.text

    def test_returns_false_when_flag_is_unknown(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("missing"), error(404, "NotFound", "Feature not found"))
        assert make_client().is_enabled("missing") is False

    def test_raises_on_4xx_other_than_404(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), error(401, "Unauthorized", "Invalid API key"))
        with pytest.raises(FlagraftError) as info:
            make_client().is_enabled("f")
        assert (info.value.status_code, info.value.code, info.value.message) == (
            401,
            "Unauthorized",
            "Invalid API key",
        )

    def test_falls_back_to_http_reason_when_error_body_is_not_json(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), Reply(403, b"nope"))
        with pytest.raises(FlagraftError) as info:
            make_client().is_enabled("f")
        assert (info.value.code, info.value.message) == ("HttpError", "Forbidden")

    def test_returns_default_when_success_body_is_not_json(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), Reply(200, b"<html>"))
        assert make_client().is_enabled("f", default=True) is True

    def test_caches_subsequent_calls_within_ttl(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client()
        client.is_enabled("f")
        client.is_enabled("f")
        assert server.hits(flag_path("f")) == 1

    def test_bypasses_cache_when_ttl_is_zero(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client(ttl=0)
        client.is_enabled("f")
        client.is_enabled("f")
        assert server.hits(flag_path("f")) == 2

    def test_works_as_a_context_manager(self, server: FakeServer) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        with FlagraftClient(server.url, "client-key") as client:
            assert client.is_enabled("f") is True


class TestContext:
    def test_stringifies_numbers_booleans_and_datetimes_into_the_query(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        make_client().is_enabled(
            "f",
            {
                "userId": "u1",
                "age": 42,
                "beta": True,
                "score": 1.0,
                "signedUpAt": datetime(2026, 1, 2, tzinfo=UTC),
            },
        )
        assert server.requests[0].query == {
            "userId": "u1",
            "age": "42",
            "beta": "true",
            "score": "1",
            "signedUpAt": "2026-01-02T00:00:00.000Z",
        }


class TestTimeout:
    def test_aborts_a_hanging_request_instead_of_waiting_forever(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), evaluation("f", False, delay=1.0))
        started = time.monotonic()
        assert make_client(timeout=0.3).is_enabled("f", default=True) is True
        assert time.monotonic() - started < 0.9

    def test_waits_when_timeout_is_zero(self, server: FakeServer, make_client: MakeClient) -> None:
        server.route(flag_path("f"), evaluation("f", True, delay=0.2))
        assert make_client(timeout=0).is_enabled("f") is True


class TestDefault:
    def test_is_returned_when_the_flag_does_not_exist(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        assert make_client().is_enabled("missing", default=True) is True

    def test_is_returned_when_the_request_fails_outright(self) -> None:
        assert FlagraftClient(UNREACHABLE, "k").is_enabled("f", default=True) is True

    def test_never_overrides_a_real_answer(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), evaluation("f", False))
        assert make_client().is_enabled("f", default=True) is False

    def test_lets_two_callers_hold_different_defaults_for_the_same_missing_flag(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        client = make_client()
        assert client.is_enabled("missing", default=True) is True
        assert client.is_enabled("missing", default=False) is False
        assert server.hits(flag_path("missing")) == 1

    def test_still_raises_on_a_misconfiguration(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), error(401, "Unauthorized", "Invalid API key"))
        with pytest.raises(FlagraftError):
            make_client().is_enabled("f", default=True)

    def test_defaults_to_false_when_omitted(self, make_client: MakeClient) -> None:
        assert make_client().is_enabled("missing") is False


class TestUnknownFlags:
    def test_asks_the_server_only_once(self, server: FakeServer, make_client: MakeClient) -> None:
        client = make_client()
        client.is_enabled("missing")
        client.is_enabled("missing")
        assert server.hits(flag_path("missing")) == 1

    def test_shares_one_entry_across_every_context(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        client = make_client()
        client.is_enabled("missing", {"userId": "a"})
        client.is_enabled("missing", {"userId": "b"})
        assert server.hits(flag_path("missing")) == 1

    def test_asks_again_once_the_entry_lapses(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        client = make_client()
        assert client.is_enabled("new") is False
        clock.advance(5)
        server.route(flag_path("new"), evaluation("new", True))
        assert client.is_enabled("new") is True
        assert server.hits(flag_path("new")) == 2

    def test_is_switched_off_when_ttl_is_zero(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        client = make_client(ttl=0)
        client.is_enabled("missing")
        client.is_enabled("missing")
        assert server.hits(flag_path("missing")) == 2

    def test_leaves_flags_that_exist_untouched(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client()
        assert client.is_enabled("missing") is False
        assert client.is_enabled("f") is True


class TestMalformedSuccessBody:
    @pytest.mark.parametrize(
        "body",
        [b"{}", b"null", b'{"name":"f","enabled":"false"}'],
        ids=["empty-object", "null", "string-enabled"],
    )
    def test_returns_default_and_is_not_cached(
        self, server: FakeServer, make_client: MakeClient, body: bytes
    ) -> None:
        server.route(flag_path("f"), Reply(200, body))
        client = make_client()
        assert client.is_enabled("f", default=True) is True
        assert client.is_enabled("f", default=True) is True
        assert server.hits(flag_path("f")) == 2


class TestOutages:
    def test_returns_default_on_500_without_raising(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), error(500, "Internal", "boom"))
        assert make_client().is_enabled("f", default=True) is True

    def test_returns_default_on_429_without_raising(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), error(429, "TooManyRequests", "slow down"))
        assert make_client().is_enabled("f", default=True) is True


class TestRedirects:
    def test_drops_authorization_on_a_cross_origin_redirect(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        other = FakeServer()
        other.start()
        try:
            other.route("/elsewhere", evaluation("f", True))
            location = {"location": other.url + "/elsewhere"}
            server.route(flag_path("f"), Reply(302, None, location))
            assert make_client().is_enabled("f") is True
            assert "authorization" not in other.requests[0].headers
        finally:
            other.stop()

    def test_keeps_authorization_on_a_same_origin_redirect(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route("/moved", evaluation("f", True))
        server.route(flag_path("f"), Reply(302, None, {"location": server.url + "/moved"}))
        assert make_client().is_enabled("f") is True
        assert server.requests[-1].path == "/moved"
        assert server.requests[-1].headers["authorization"] == "client-key"


class TestNegativeTtl:
    def test_negative_ttl_switches_the_negative_cache_off(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        client = make_client(ttl=-1)
        client.is_enabled("missing")
        client.is_enabled("missing")
        assert server.hits(flag_path("missing")) == 2


class TestGetFeatures:
    def test_returns_a_flag_map_keyed_by_name(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(BULK, feature_list(("a", True), ("b", False)))
        assert make_client().get_features() == {"a": True, "b": False}

    def test_get_all_features_returns_the_raw_list(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(BULK, feature_list(("a", True)))
        assert make_client().get_all_features() == [{"name": "a", "enabled": True}]

    def test_caches_the_bulk_response_by_context(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(BULK, feature_list(("a", True)))
        client = make_client()
        client.get_features({"userId": "u1"})
        client.get_features({"userId": "u1"})
        client.get_features({"userId": "u2"})
        assert server.hits(BULK) == 2

    def test_issues_a_fresh_request_after_ttl_expiry(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, feature_list(("a", True)))
        client = make_client()
        client.get_features()
        clock.advance(30)
        client.get_features()
        assert server.hits(BULK) == 2

    def test_returns_an_empty_list_on_a_500(
        self, server: FakeServer, make_client: MakeClient, caplog: pytest.LogCaptureFixture
    ) -> None:
        server.route(BULK, error(500, "InternalServerError", "boom"))
        assert make_client().get_all_features() == []
        assert "bulk evaluation failed" in caplog.text

    def test_raises_on_a_caller_error(self, server: FakeServer, make_client: MakeClient) -> None:
        server.route(BULK, error(401, "Unauthorized", "Invalid API key"))
        with pytest.raises(FlagraftError):
            make_client().get_features()


def etag_route(received: Received) -> Reply:
    if received.headers.get("if-none-match") == '"v1"':
        return Reply(304)
    return feature_list(("a", True), etag='"v1"')


class TestConditionalRequests:
    def test_sends_the_stored_etag_when_revalidating(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, etag_route)
        client = make_client()
        client.get_all_features()
        clock.advance(30)
        client.get_all_features()
        assert server.requests[1].headers["if-none-match"] == '"v1"'

    def test_keeps_the_cached_body_on_304(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, etag_route)
        client = make_client()
        client.get_all_features()
        clock.advance(30)
        assert client.get_all_features() == [{"name": "a", "enabled": True}]

    def test_gives_the_revalidated_entry_a_fresh_ttl(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, etag_route)
        client = make_client()
        client.get_all_features()
        clock.advance(30)
        client.get_all_features()
        clock.advance(29)
        client.get_all_features()
        assert server.hits(BULK) == 2

    def test_takes_the_new_body_when_flags_changed(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, feature_list(("a", True), etag='"v1"'))
        client = make_client()
        client.get_all_features()
        server.route(BULK, feature_list(("a", False), etag='"v2"'))
        clock.advance(30)
        assert client.get_all_features() == [{"name": "a", "enabled": False}]

    def test_does_not_revalidate_once_the_body_is_dropped(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, etag_route)
        client = make_client()
        client.get_all_features()
        clock.advance(30 + 300)
        client.get_all_features()
        assert "if-none-match" not in server.requests[1].headers

    def test_works_against_a_server_that_sends_no_etag(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, feature_list(("a", True)))
        client = make_client()
        client.get_all_features()
        clock.advance(30)
        assert client.get_all_features() == [{"name": "a", "enabled": True}]
        assert "if-none-match" not in server.requests[1].headers


class TestMalformedBulkBody:
    @pytest.mark.parametrize(
        "body",
        [{"features": [{"name": "a", "enabled": "yes"}]}, {}, [], b"<html>"],
    )
    def test_returns_an_empty_list_and_does_not_cache(
        self,
        server: FakeServer,
        make_client: MakeClient,
        caplog: pytest.LogCaptureFixture,
        body: object,
    ) -> None:
        server.route(BULK, Reply(body=body))
        client = make_client()
        assert client.get_all_features() == []
        assert client.get_all_features() == []
        assert server.hits(BULK) == 2
        assert "bulk evaluation failed" in caplog.text


class TestBulkRobustness:
    def test_an_unexpected_304_is_not_cached_as_an_empty_list(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(BULK, Reply(304))
        server.route(flag_path("a"), evaluation("a", True))
        client = make_client()
        assert client.get_all_features() == []
        assert client.is_enabled("a") is True
        assert server.hits(flag_path("a")) == 1

    def test_mutating_the_returned_list_does_not_change_the_cache(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(BULK, feature_list(("a", True)))
        client = make_client()
        first = client.get_all_features()
        first[0]["enabled"] = False
        first.clear()
        assert client.get_all_features() == [{"name": "a", "enabled": True}]

    def test_keeps_the_stored_etag_when_a_304_carries_none(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        replies = iter([feature_list(("a", True), etag='"v1"'), Reply(304), Reply(304)])
        server.route(BULK, lambda _: next(replies))
        client = make_client()
        client.get_all_features()
        clock.advance(30)
        client.get_all_features()
        clock.advance(30)
        client.get_all_features()
        assert server.requests[2].headers["if-none-match"] == '"v1"'


class TestIsEnabledFromBulk:
    @pytest.fixture(autouse=True)
    def routes(self, server: FakeServer) -> None:
        server.route(BULK, feature_list(("a", True), ("b", False)))
        server.route(flag_path("a"), evaluation("a", True))

    def test_reuses_a_hydrated_bulk_response(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        client = make_client()
        client.get_features()
        assert client.is_enabled("a") is True
        assert client.is_enabled("b") is False
        assert server.hits(flag_path("a")) == 0

    def test_treats_a_flag_absent_from_the_bulk_list_as_missing(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        client = make_client()
        client.get_features()
        assert client.is_enabled("zzz", default=True) is True
        assert server.hits(flag_path("zzz")) == 0

    def test_does_not_reuse_a_bulk_response_for_another_context(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        client = make_client()
        client.get_features({"userId": "u1"})
        client.is_enabled("a", {"userId": "u2"})
        assert server.hits(flag_path("a")) == 1

    def test_falls_through_to_the_single_endpoint_without_a_bulk_response(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        assert make_client().is_enabled("a") is True
        assert server.hits(flag_path("a")) == 1

    def test_ignores_the_bulk_cache_when_ttl_is_zero(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        client = make_client(ttl=0)
        client.get_features()
        client.is_enabled("a")
        assert server.hits(flag_path("a")) == 1


BOOM = error(500, "InternalServerError", "boom")


class TestStaleOnError:
    def test_serves_the_last_known_value_when_a_refetch_fails(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client()
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), BOOM)
        assert client.is_enabled("f") is True

    def test_serves_the_last_known_value_when_the_server_is_gone(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client()
        client.is_enabled("f")
        clock.advance(30)
        server.stop()
        assert client.is_enabled("f") is True

    def test_falls_back_to_the_default_once_the_stale_window_closes(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client()
        client.is_enabled("f")
        clock.advance(30 + 300)
        server.route(flag_path("f"), BOOM)
        assert client.is_enabled("f") is False

    def test_stale_value_beats_the_default(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), evaluation("f", False))
        client = make_client()
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), BOOM)
        assert client.is_enabled("f", default=True) is False

    def test_serves_stale_after_a_caller_error_instead_of_raising(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client()
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), error(401, "Unauthorized", "Invalid API key"))
        assert client.is_enabled("f") is True

    def test_still_raises_when_there_is_no_stale_value(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client(stale_ttl=0)
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), error(401, "Unauthorized", "Invalid API key"))
        with pytest.raises(FlagraftError):
            client.is_enabled("f")

    def test_keeps_404_as_the_default_rather_than_serving_stale(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client()
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), error(404, "NotFound", "Feature not found"))
        assert client.is_enabled("f") is False

    def test_serves_a_stale_bulk_response_to_is_enabled(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, feature_list(("a", True)))
        client = make_client()
        client.get_features()
        clock.advance(30)
        server.route(flag_path("a"), BOOM)
        assert client.is_enabled("a") is True

    def test_serves_the_stale_feature_list(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, feature_list(("a", True)))
        client = make_client()
        client.get_all_features()
        clock.advance(30)
        server.route(BULK, BOOM)
        assert client.get_all_features() == [{"name": "a", "enabled": True}]

    def test_stale_feature_list_is_a_copy(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(BULK, feature_list(("a", True)))
        client = make_client()
        client.get_all_features()
        clock.advance(30)
        server.route(BULK, BOOM)
        client.get_all_features().clear()
        assert client.get_all_features() == [{"name": "a", "enabled": True}]

    def test_serves_the_stale_value_when_a_refetch_times_out(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client(timeout=0.3)
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), evaluation("f", False, delay=1.0))
        assert client.is_enabled("f") is True

    def test_returns_an_empty_list_when_a_bulk_request_times_out(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(BULK, feature_list(("a", True), delay=1.0))
        assert make_client(timeout=0.3).get_all_features() == []

    def test_calls_on_stale_with_the_flag_and_fetch_time(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        events: list[StaleEvent] = []
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client(on_stale=events.append)
        fetched = clock.now
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), BOOM)
        client.is_enabled("f")
        assert events == [StaleEvent("f", datetime.fromtimestamp(fetched, UTC))]

    def test_reports_none_as_the_flag_for_a_stale_feature_list(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        events: list[StaleEvent] = []
        server.route(BULK, feature_list(("a", True)))
        client = make_client(on_stale=events.append)
        client.get_all_features()
        clock.advance(30)
        server.route(BULK, BOOM)
        client.get_all_features()
        assert events[0].flag_key is None

    def test_logs_a_warning_when_no_callback_is_set(
        self,
        server: FakeServer,
        make_client: MakeClient,
        clock: Clock,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client()
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), BOOM)
        client.is_enabled("f")
        assert "serving stale value for f (fetched 30s ago)" in caplog.text

    def test_does_not_let_a_raising_on_stale_break_evaluation(
        self,
        server: FakeServer,
        make_client: MakeClient,
        clock: Clock,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        def explode(event: StaleEvent) -> None:
            raise RuntimeError("metrics down")

        server.route(flag_path("f"), evaluation("f", True))
        client = make_client(on_stale=explode)
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), BOOM)
        assert client.is_enabled("f") is True
        assert "on_stale callback raised" in caplog.text


def rate_limited(retry_after: str | None = None) -> Reply:
    headers = {"retry-after": retry_after} if retry_after is not None else {}
    return error(429, "TooManyRequests", "Rate limit exceeded", headers)


class TestRateLimiting:
    def test_falls_back_to_the_default_instead_of_raising(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(flag_path("f"), rate_limited("10"))
        assert make_client().is_enabled("f", default=True) is True

    def test_serves_a_stale_value_when_one_exists(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), evaluation("f", True))
        client = make_client()
        client.is_enabled("f")
        clock.advance(30)
        server.route(flag_path("f"), rate_limited("10"))
        assert client.is_enabled("f") is True

    def test_stops_sending_requests_for_the_retry_after_window(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), rate_limited("10"))
        client = make_client()
        client.is_enabled("f")
        client.is_enabled("f")
        clock.advance(9)
        client.is_enabled("f")
        assert server.hits(flag_path("f")) == 1

    def test_resumes_once_the_window_passes(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), rate_limited("10"))
        client = make_client()
        client.is_enabled("f")
        clock.advance(10)
        server.route(flag_path("f"), evaluation("f", True))
        assert client.is_enabled("f") is True

    def test_backs_off_for_a_default_window_when_retry_after_is_missing(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), rate_limited())
        client = make_client()
        client.is_enabled("f")
        clock.advance(4)
        client.is_enabled("f")
        assert server.hits(flag_path("f")) == 1
        clock.advance(1)
        client.is_enabled("f")
        assert server.hits(flag_path("f")) == 2

    def test_accepts_an_http_date_retry_after(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), rate_limited(formatdate(clock.now + 20, usegmt=True)))
        client = make_client()
        client.is_enabled("f")
        clock.advance(19)
        client.is_enabled("f")
        assert server.hits(flag_path("f")) == 1
        clock.advance(1)
        client.is_enabled("f")
        assert server.hits(flag_path("f")) == 2

    def test_reads_a_zoneless_http_date_as_gmt(
        self,
        server: FakeServer,
        make_client: MakeClient,
        clock: Clock,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("TZ", "Asia/Kolkata")
        time.tzset()
        try:
            date = formatdate(clock.now + 20, usegmt=True).replace("GMT", "-0000")
            server.route(flag_path("f"), rate_limited(date))
            client = make_client()
            client.is_enabled("f")
            clock.advance(19)
            client.is_enabled("f")
            assert server.hits(flag_path("f")) == 1
            clock.advance(1)
            client.is_enabled("f")
            assert server.hits(flag_path("f")) == 2
        finally:
            monkeypatch.undo()
            time.tzset()

    def test_caps_an_absurd_retry_after(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), rate_limited("86400"))
        client = make_client()
        client.is_enabled("f")
        clock.advance(60)
        client.is_enabled("f")
        assert server.hits(flag_path("f")) == 2

    def test_ignores_an_unparseable_retry_after(
        self, server: FakeServer, make_client: MakeClient, clock: Clock
    ) -> None:
        server.route(flag_path("f"), rate_limited("soon"))
        client = make_client()
        client.is_enabled("f")
        clock.advance(5)
        client.is_enabled("f")
        assert server.hits(flag_path("f")) == 2

    def test_warns_once_per_window_rather_than_once_per_call(
        self, server: FakeServer, make_client: MakeClient, caplog: pytest.LogCaptureFixture
    ) -> None:
        server.route(flag_path("f"), rate_limited("10"))
        client = make_client()
        for _ in range(3):
            client.is_enabled("f")
        assert caplog.text.count("rate limited") == 1
        assert "flag evaluation failed" not in caplog.text

    def test_returns_an_empty_list_for_a_rate_limited_bulk_call(
        self, server: FakeServer, make_client: MakeClient
    ) -> None:
        server.route(BULK, rate_limited("10"))
        assert make_client().get_all_features() == []


def test_concurrent_callers_get_correct_answers(
    server: FakeServer, make_client: MakeClient
) -> None:
    for i in range(10):
        server.route(flag_path(f"f{i}"), evaluation(f"f{i}", i % 2 == 0))
    client = make_client(timeout=10)

    def call(n: int) -> bool:
        return client.is_enabled(f"f{n % 10}", {"userId": str(n % 7)})

    with ThreadPoolExecutor(max_workers=50) as pool:
        results = list(pool.map(call, range(1000)))
    assert results == [(n % 10) % 2 == 0 for n in range(1000)]
