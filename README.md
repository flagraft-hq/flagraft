# Veltra

Self-hosted feature flag service built with Node 20, Fastify, Drizzle, and Postgres.

## Quickstart

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Create local config:

   ```sh
   cp .env.example .env
   ```

3. Start Postgres:

   ```sh
   docker compose up -d
   ```

4. Run migrations:

   ```sh
   pnpm db:migrate
   ```

5. Create the root admin key:

   ```sh
   pnpm admin:create-root-key
   ```

   Save the printed key. It is only shown once.

6. Start the API:

   ```sh
   pnpm dev
   ```

7. Verify:

   ```sh
   curl -H "Authorization: <root_key>" http://localhost:3000/api/admin/projects
   ```

## Tests

Unit tests run without Postgres:

```sh
pnpm test
```

Integration tests run when `TEST_DATABASE_URL` is set. With the bundled compose file, the test database is created as `veltra_test` on first container initialization.

```sh
DATABASE_URL=postgres://veltra:veltra@localhost:5432/veltra_test pnpm db:migrate
TEST_DATABASE_URL=postgres://veltra:veltra@localhost:5432/veltra_test pnpm test
```

## Scripts

- `pnpm dev` starts the Fastify server through `tsx watch`.
- `pnpm build` creates dual ESM/CJS bundles in `dist`.
- `pnpm typecheck` runs TypeScript without emitting files.
- `pnpm db:generate` generates Drizzle migrations.
- `pnpm db:migrate` applies migrations.
- `pnpm admin:create-root-key` inserts a root admin API key.

## Troubleshooting

If `pnpm admin:create-root-key` fails with `relation "api_keys" does not exist`, run `pnpm db:migrate` first.
