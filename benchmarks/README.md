# Benchmarks

Two separate things, measured separately:

- **Server** — HTTP throughput of the client evaluation endpoints (`benchmarks/server.ts`, autocannon).
- **SDK** — in-process cost of a flag lookup with fetch stubbed (`benchmarks/sdk.bench.ts`, `vitest bench`).

## Server

Build and start the server first. Never benchmark `pnpm dev` — tsx watch numbers are meaningless.

```bash
pnpm build
DATABASE_URL=postgres://... RATE_LIMIT_MAX=1000000 NODE_ENV=production LOG_LEVEL=error pnpm start
```

`RATE_LIMIT_MAX` matters: the default of 100/min throttles the load test after the first second. `server.ts` exits non-zero if it sees non-2xx responses, so a throttled run fails loudly rather than reporting a fake number.

Then, in another shell:

```bash
DATABASE_URL=postgres://... pnpm bench:seed   # creates a project + 100 flags, writes benchmarks/.bench.json
pnpm bench:server
```

Three scenarios run: all flags served from cache, the 304 path an SDK with a warm ETag takes, and a single-flag lookup.

Knobs (env vars):

| Var                 | Default                 | Notes                                                                  |
| ------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `BENCH_FLAGS`       | `100`                   | Seed size. Try 10 / 100 / 500 — `evaluateAll` is linear in flag count. |
| `BENCH_CONNECTIONS` | `50`                    | Concurrent connections.                                                |
| `BENCH_DURATION`    | `10`                    | Seconds per scenario.                                                  |
| `BENCH_BASE_URL`    | `http://localhost:3000` | Seed target.                                                           |

Each flag count seeds its own project (`bench-100`, `bench-500`, …), so switching sizes needs no database wipe. Re-seeding the same size fails on the duplicate slug — delete the project or truncate first.

To measure the database floor instead of the cache, restart the server with `CACHE_TTL_SECONDS=1` and re-run.

## SDK

No server or database needed:

```bash
pnpm bench:sdk
BENCH_FLAGS=500 pnpm bench:sdk   # bulk payload size drives the scan cost
```

Reports ops/sec for cache hits (bulk and single) and for the cache-disabled path, which is where request building and JSON parsing show up.

## Not covered

No CI regression gate and no cross-vendor comparison. Add those once there is a number worth defending.
