#!/bin/sh
set -e

# Bring the database schema up to date, then hand off to the server.
# Migrations are idempotent, so this is safe on every start.
node dist/db/migrate.cjs
exec node dist/server.cjs
