FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/admin-ui/package.json ./packages/admin-ui/
COPY packages/sdk-js/package.json ./packages/sdk-js/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm ui:build

FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-workspace

COPY --from=builder /app/dist ./dist
# Applied at startup unless RUN_MIGRATIONS=false. Same path as the repo so the
# migrator needs no configuration.
COPY --from=builder /app/src/db/migrations ./src/db/migrations
# Served at / by the server, so one container is the whole product.
COPY --from=builder /app/packages/admin-ui/dist ./public

EXPOSE 3000

# /ready returns 503 when the database is unreachable, which wget turns into a
# non-zero exit. Reads PORT so the check follows a server moved off 3000.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-3000}/ready" || exit 1

# Nothing here is written at runtime, so the app dir stays root-owned and the
# server only reads it.
USER node

CMD ["node", "dist/server.cjs"]
