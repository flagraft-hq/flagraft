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

End-to-end tests are Playwright and are **not** in CI yet. They expect the API on
:3000 and the UI on :5173, both already running:

```sh
pnpm test:e2e
```

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

## Reporting bugs and asking for features

Use the issue templates. For anything security related, do **not** open an issue
-- see [SECURITY.md](SECURITY.md).
