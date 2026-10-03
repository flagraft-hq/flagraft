from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fakes import FakeServer

from flagraft import FlagraftClient, _clock


class Clock:
    def __init__(self) -> None:
        self.now = 1_700_000_000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture(autouse=True)
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    fake = Clock()
    monkeypatch.setattr(_clock, "now", fake)
    return fake


@pytest.fixture
def server() -> Iterator[FakeServer]:
    fake = FakeServer()
    fake.start()
    yield fake
    fake.stop()


@pytest.fixture
def make_client(server: FakeServer) -> Callable[..., FlagraftClient]:
    def make(**options: Any) -> FlagraftClient:
        return FlagraftClient(server.url, "client-key", **options)

    return make


@pytest.fixture(autouse=True)
def no_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NO_PROXY", "127.0.0.1")
    monkeypatch.setenv("no_proxy", "127.0.0.1")
