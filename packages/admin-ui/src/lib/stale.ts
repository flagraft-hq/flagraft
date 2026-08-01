/**
 * A flag is stale when it hasn't changed value (toggled or edited) for longer
 * than the project's stale window. A null/undefined window means "never stale".
 */
export function isFlagStale(
  updatedIso: string | undefined,
  staleFlagDays: number | null | undefined,
  now: number = Date.now(),
): boolean {
  if (staleFlagDays == null || !updatedIso) return false
  const updated = new Date(updatedIso).getTime()
  if (Number.isNaN(updated)) return false
  return now - updated > staleFlagDays * 24 * 60 * 60 * 1000
}
