FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

# Install every workspace dependency (root + packages) for the build.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/admin-ui/package.json ./packages/admin-ui/
RUN pnpm install --frozen-lockfile

COPY . .

# Build the API (dist/) and the admin UI. VITE_API_URL='' makes the SPA call the
# API on its own origin (relative /api/...), so no CORS or proxy is needed.
RUN pnpm build
RUN VITE_API_URL='' pnpm ui:build

FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Server build, migrator, migration files (incl. meta/ journal), and the built UI.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./migrations
COPY --from=builder /app/packages/admin-ui/dist ./ui
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Production defaults. Override JWT_SECRET and DEFAULT_ADMIN_PASSWORD before
# exposing this publicly. DEFAULT_ADMIN_PASSWORD must not be the documented
# fallback ("flagraft-admin") or the server refuses to boot in production.
ENV NODE_ENV=production \
    PORT=3000 \
    MIGRATIONS_DIR=/app/migrations \
    UI_DIR=/app/ui \
    JWT_SECRET=change-this-jwt-secret-to-a-long-random-value \
    DEFAULT_ADMIN_EMAIL=admin@flagraft.local \
    DEFAULT_ADMIN_PASSWORD=changeme \
    DEFAULT_ADMIN_NAME=Admin

EXPOSE 3000

# Liveness check so orchestrators can tell when the container is serving.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
