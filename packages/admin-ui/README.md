# @flagraft/admin-ui

Web UI for managing Flagraft projects, environments, flags, overrides, and API keys.

## Stack

- React 18 + TypeScript
- Vite (dev server, build)
- Tailwind CSS (Knowmax brand tokens scaffolded under `theme.extend.colors.brand`)
- React Router for client-side routing
- Vitest + Testing Library for component tests

## Scripts

Run from the repo root:

```bash
pnpm --filter @flagraft/admin-ui dev          # start Vite dev server on :5173
pnpm --filter @flagraft/admin-ui build        # type-check + production build
pnpm --filter @flagraft/admin-ui typecheck
pnpm --filter @flagraft/admin-ui test
```

The dev server proxies `/api/*` to `http://localhost:3000` so it can talk to the Flagraft service running locally.

## Status

Phase 5 boilerplate. Login, project list, flag detail, and component work follow per `docs/ROADMAP.md`.
