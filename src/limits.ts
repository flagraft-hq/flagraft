/**
 * Hard ceiling on page size for every paginated list endpoint, so no caller
 * can ask for a whole table in one request.
 */
export const MAX_PAGE_SIZE = 100

/**
 * Per-project ceilings on things there is no pagination for. Both tables are
 * meant to stay small enough to read at a glance, so the limit is enforced at
 * creation time instead of adding a pager.
 *
 * Mirrored in packages/admin-ui/src/lib/limits.ts -- keep the two in sync.
 */
export const MAX_CONTEXT_FIELDS_PER_PROJECT = 25
export const MAX_ENVIRONMENTS_PER_PROJECT = 3

/**
 * Body size ceiling for the import routes. Fastify defaults every route to 1MB,
 * which a real Unleash export from a large install goes past, so the import
 * routes raise it on their own. Everything else keeps the 1MB default.
 */
export const MAX_IMPORT_BODY_BYTES = 10 * 1024 * 1024
