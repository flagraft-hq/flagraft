# Contributing to Flagraft

Thanks for taking the time. Flagraft is a small, deliberately boring codebase, and
the aim is to keep it that way.

## Getting set up

You need Node 20+, pnpm 10, and Docker (for Postgres).

```sh
pnpm install
docker compose up -d          # Postgres on :5432, plus the test database
cp .env.example .env          # then set DATABASE_URL and JWT_SECRET
pnpm db:migrate
pnpm dev                      # API on :3000
pnpm ui:dev                   # admin UI on :5173
```

`pnpm dev:all` runs both at once.

`JWT_SECRET` must be at least 32 characters or the server refuses to start:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running the checks

CI runs these, so run them before opening a pull request:

```sh
pnpm lint          # typecheck across all packages, then eslint
pnpm format:check  # prettier
pnpm test          # server tests, then every package's tests
pnpm build         # tsup bundle
```

The integration tests need a second database. `docker compose up` creates it via
`docker/initdb/01-test-db.sql`; point `TEST_DATABASE_URL` at it and run
`pnpm db:migrate` against it once. Tests that need a database skip themselves
when `TEST_DATABASE_URL` is unset, so a bare `pnpm test` passes without ever
telling you it silently skipped half the suite -- check the skip count.

End-to-end tests are Playwright. One command builds the server and the UI,
starts them, runs the suite and shuts the server down again:

```sh
pnpm test:e2e
```

It runs against what ships -- one server on one origin serving both the UI and
the API -- not the Vite dev proxy.

It uses port 3999 rather than 3000, because the e2e server is a throwaway and
3000 is the port most likely to already have something on it. Override with
`E2E_PORT` if 3999 is taken too.

That command rebuilds every time, which is right for a one-off but wasteful when
iterating. Start the server once and leave it up; runs then reuse it and skip the
build entirely (~24s instead of ~45s):

```sh
pnpm e2e:server &        # build once, keep it running
npx playwright test      # reuses it, no rebuild
```

Rebuild by restarting that server after changing the app.

To run against a server you started yourself, which skips the build:

```sh
E2E_BASE_URL=http://localhost:5173 pnpm test:e2e
```

Useful while iterating: `npx playwright test --headed` to watch it,
`--debug` to step through, `-g "sign out"` for one test, and
`npx playwright show-report` after a failure. Pass `E2E_PORT` the same way.

## Changing the database

Schema lives in `src/db/schema.ts`. After editing it:

```sh
pnpm db:generate   # writes a migration into src/db/migrations
pnpm db:migrate    # applies it
```

Commit the generated SQL. Never edit a migration that has already been applied --
Drizzle records a hash of each one and will refuse to run against a changed file.

## House style

- **Tests are required.** Every fix and feature lands with one. Non-trivial logic
  leaves behind the smallest test that fails if the logic breaks.
- **Comments are the exception.** Default to none. When one is genuinely needed,
  it is one line and explains what the code cannot: a library's surprising
  behavior, a deliberate trade-off, a branch that looks wrong but isn't. Use
  JSDoc `/** ... */`, never `//` for multiple lines.
- **Document what a user can see.** A new environment variable, config value or
  behavior change belongs in the README config table and `.env.example`, not one
  of the two.
- Prettier and ESLint decide formatting arguments. Run `pnpm format`.

## Pull requests

Keep them focused -- one concern per PR. Describe what changes for someone
running Flagraft, not just what you edited. If you changed behavior, say so in
`CHANGELOG.md` under `[Unreleased]`.

Flagraft is pre-1.0 and the roadmap ([docs/ROADMAP.md](docs/ROADMAP.md)) says what
is planned and what is deliberately not. Worth a look before building something
large -- it may already be a decided "no", and that is nothing personal.

## Releasing

Releases are cut by hand; there is no publish workflow. The SDK is the only
published artifact.

```sh
pnpm --filter @flagraft/sdk typecheck
pnpm --filter @flagraft/sdk test
pnpm --filter @flagraft/sdk build

cd packages/sdk-js
npm publish --dry-run --tag alpha --access public   # read the file list first
npm publish --tag alpha --access public
```

Two rules the tooling will not enforce for you:

- **A prerelease never goes out as `latest`.** While the version carries a
  `-alpha.N` suffix it publishes under `--tag alpha`, so `npm i @flagraft/sdk`
  resolves to nothing and only `@flagraft/sdk@alpha` installs. Drop the suffix
  and switch to `--tag latest` in the same change, never separately.
- **`--access public` every time.** `@flagraft/sdk` is scoped, and scoped
  packages default to restricted. `publishConfig` in `package.json` sets it too;
  the flag is belt and braces.

Publishing cannot be undone after 72 hours, so the dry run is worth the extra
minute. `--provenance` is deliberately absent: it needs a CI environment with
OIDC and fails from a laptop.

Then tag the repo and write the release notes from `CHANGELOG.md`:

```sh
git tag v0.1.0-alpha.0 && git push origin v0.1.0-alpha.0
```

## Reporting bugs and asking for features

Use the issue templates. For anything security related, do **not** open an issue
-- see [SECURITY.md](SECURITY.md).
