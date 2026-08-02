/**
 * Per-project ceilings on things there is no pagination for. Both lists are
 * meant to stay small enough to read at a glance, so the limit is enforced
 * when creating instead of adding a pager.
 *
 * Mirrors src/limits.ts on the backend -- keep the two in sync.
 */
export const MAX_CONTEXT_FIELDS_PER_PROJECT = 25
export const MAX_ENVIRONMENTS_PER_PROJECT = 3
