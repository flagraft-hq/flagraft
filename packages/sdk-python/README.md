# flagraft

The official Python SDK for [Flagraft](https://github.com/flagraft-hq/flagraft#readme), a self-hosted feature flag service. It gives your application a typed, cached, fail-safe client for evaluating flags.

> Python 3.11+. Zero runtime dependencies. Sync API, safe to share across threads.

## Install

Flagraft is in alpha, so releases are pre-releases:

```bash
pip install --pre flagraft
```

Until the first release lands on PyPI, install from the repository:

```bash
pip install "git+https://github.com/flagraft-hq/flagraft#subdirectory=packages/sdk-python"
```

You need a running Flagraft server and a **client API key** issued by a project admin. Admin keys are rejected at the evaluation routes.

## Quickstart

```python
from flagraft import FlagraftClient

flags = FlagraftClient("https://flags.example.com", api_key="<client key>")

if flags.is_enabled("new-checkout", {"userId": user.id, "plan": user.plan}):
    render_new_checkout()
```

Create one client per process and share it. It is thread-safe, so Django, Flask and Celery workers can all use the same instance.

The client also works as a context manager, which calls `close()` on exit. `close()` clears the caches:

```python
with FlagraftClient(base_url, api_key) as flags:
    ...
```

For asyncio code, call it from a worker thread: `await asyncio.to_thread(flags.is_enabled, "new-checkout", ctx)`.

## Configuration

| Option      | Default  | Meaning                                                                                                                                     |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `base_url`  | required | Flagraft server URL. Trailing slashes are ignored.                                                                                          |
| `api_key`   | required | Client API key, sent as the `authorization` header.                                                                                         |
| `ttl`       | `30`     | Seconds a fetched value counts as fresh. `0` disables all caching.                                                                          |
| `stale_ttl` | `300`    | Seconds an expired value stays usable when the server cannot be reached. `0` disables the fallback.                                         |
| `timeout`   | `2.0`    | Seconds allowed per socket operation (see [Network behavior](#network-behavior)). `0` waits forever.                                        |
| `on_stale`  | `None`   | `Callable[[StaleEvent], None]`, called when a stale value is served. Without it a warning is logged. An exception it raises is logged only. |

## API

### `is_enabled(flag_key, context=None, default=False) -> bool`

Evaluates one flag. `default` is returned when the server cannot answer (an unknown flag, an unreachable server, a timeout). It matters for any flag whose safe state is "on", such as a kill switch.

Raises `FlagraftError` only for mistakes you need to fix: a 4xx other than 404 and 429 (a bad key, a wrong scope). It raises only when no stale value is available; otherwise the stale value is served.

### `get_features(context=None) -> dict[str, bool]`

Every flag for the context as `{name: enabled}`. Raises `FlagraftError` under the same rule as `is_enabled`.

### `get_all_features(context=None) -> list[Feature]`

The same data as a list of `{"name": ..., "enabled": ...}` dicts. The returned list is a copy, so mutating it does not affect the cache. Raises like `get_features`.

### Context

A mapping of `str` to `str | int | float | bool | datetime`. Values are converted the same way the TypeScript SDK converts them: booleans become `"true"`/`"false"`, floats use JavaScript number formatting (`1.0` → `"1"`, `1e-6` → `"0.000001"`, `1e-7` → `"1e-7"`), and datetimes become ISO 8601 in UTC (naive datetimes are treated as UTC).

### `StaleEvent`

The argument passed to `on_stale`. A frozen dataclass with two fields:

- `flag_key: str | None`: the flag that was served stale, or `None` when the whole feature list was.
- `fetched_at: datetime`: when the served value was fetched, in UTC.

### `FlagraftError`

Has `message`, `status_code` and `code` (the server's `error` field, or `"HttpError"`). It survives pickling, so it can cross process boundaries in Celery and `multiprocessing`.

## Failure behavior

Matches [`@flagraft/sdk`](https://github.com/flagraft-hq/flagraft/tree/main/packages/sdk-js#readme):

- **Cache.** Results are cached per `(flag, context)` for `ttl` seconds, capped at 10,000 entries per cache, oldest dropped first.
- **Shared bulk cache.** After `get_features`/`get_all_features`, `is_enabled` answers from that response for the same context without a request.
- **Conditional requests.** The bulk call revalidates with `If-None-Match`; an unchanged list costs a 304 with no body.
- **Unknown flags.** A 404 returns `default` and is remembered for 5 seconds, for every context.
- **Stale-on-error.** When a refetch fails, the last value fetched within `stale_ttl` is served before falling back to `default`.
- **Rate limits.** A 429 pauses all requests for the `Retry-After` period (seconds or HTTP date; 5 s if missing; never more than 60 s). A date without a time zone is read as GMT. Stale values or `default` are served meanwhile, and a line is logged once per 429 response.
- **Caller errors.** A 4xx other than 404 and 429 raises `FlagraftError` from every method, but only when no stale value is available.
- **Malformed responses.** A body of the wrong shape is treated as a failure: stale value, then `default` (or `[]` for the bulk calls). It is never cached.

## Network behavior

- **Timeout.** `timeout` applies to each socket operation (the connect and each read), not to the request as a whole. A server that sends data slowly but steadily can take longer in total.
- **Redirects.** Followed. The API key is sent only to the same origin (scheme plus host and port) and is dropped on a cross-origin redirect.
- **Proxies.** The `HTTP_PROXY`, `HTTPS_PROXY` and `NO_PROXY` environment variables are honored, as in the standard library's `urllib`.
- **Connections.** Each request opens a new connection; there is no pooling. Caching keeps requests rare, but a first call pays the TCP and TLS handshake.
- **Plain `http://`.** The API key is sent in cleartext. Use `https://` in production.

## Logging

Warnings go to the `flagraft` logger. With no logging configured, Python's fallback handler prints warnings to stderr. Silence or route them with the standard `logging` module, for example `logging.getLogger("flagraft").setLevel(logging.ERROR)`.

During an outage, a line is logged for each stale value served (unless `on_stale` is set) and for each failed call outside a rate-limit pause. On a busy service, pass `on_stale` to handle staleness yourself, or add a logging filter to the `flagraft` logger.

## Development

```bash
cd packages/sdk-python
uv sync
uv run pytest
uv run ruff check && uv run ruff format --check && uv run mypy
```
