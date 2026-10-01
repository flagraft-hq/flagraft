import json
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, TypeAlias
from urllib.parse import parse_qs, quote, urlsplit

BULK = "/api/v1/client/features"


def flag_path(flag_key: str) -> str:
    return f"{BULK}/{quote(flag_key, safe='')}"


@dataclass
class Reply:
    status: int = 200
    body: Any = None
    headers: dict[str, str] = field(default_factory=dict)
    delay: float = 0.0


@dataclass
class Received:
    path: str
    query: dict[str, str]
    headers: dict[str, str]


Route: TypeAlias = Reply | Callable[[Received], Reply]


def evaluation(name: str, enabled: bool, delay: float = 0.0) -> Reply:
    body = {"name": name, "enabled": enabled, "reason": "strategy-match"}
    return Reply(body=body, delay=delay)


def feature_list(*pairs: tuple[str, bool], etag: str | None = None, delay: float = 0.0) -> Reply:
    body = {"features": [{"name": n, "enabled": e} for n, e in pairs]}
    return Reply(body=body, headers={"etag": etag} if etag else {}, delay=delay)


def error(status: int, code: str, message: str, headers: dict[str, str] | None = None) -> Reply:
    body = {"error": code, "message": message, "statusCode": status}
    return Reply(status, body, headers or {})


NOT_ROUTED = error(404, "NotFound", "Feature not found")


class FakeServer:
    def __init__(self) -> None:
        self.routes: dict[str, Route] = {}
        self.requests: list[Received] = []
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                parts = urlsplit(self.path)
                received = Received(
                    parts.path,
                    {k: v[0] for k, v in parse_qs(parts.query).items()},
                    {k.lower(): v for k, v in self.headers.items()},
                )
                fake.requests.append(received)
                route = fake.routes.get(parts.path, NOT_ROUTED)
                reply = route(received) if callable(route) else route
                if reply.delay:
                    time.sleep(reply.delay)
                if reply.body is None:
                    payload = b""
                elif isinstance(reply.body, bytes):
                    payload = reply.body
                else:
                    payload = json.dumps(reply.body).encode()
                self.send_response(reply.status)
                for name, value in reply.headers.items():
                    self.send_header(name, value)
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *args: Any) -> None:
                pass

        class Server(ThreadingHTTPServer):
            daemon_threads = True
            request_queue_size = 128

            def handle_error(self, request: Any, client_address: Any) -> None:
                pass  # A client that timed out leaves a broken pipe behind; that is expected.

        self._httpd = Server(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self._httpd.server_address[1]}"
        self._thread = threading.Thread(target=self._httpd.serve_forever, args=(0.01,), daemon=True)
        self._running = False

    def start(self) -> None:
        self._thread.start()
        self._running = True

    def stop(self) -> None:
        if self._running:
            self._running = False
            self._httpd.shutdown()
            self._httpd.server_close()

    def route(self, path: str, reply: Route) -> None:
        self.routes[path] = reply

    def hits(self, path: str) -> int:
        return sum(1 for r in self.requests if r.path == path)
