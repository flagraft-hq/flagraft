/**
 * Absolute date for timestamps that are facts rather than activity -- "Joined",
 * "Expires". Activity ("last used", "last login") uses `useRelativeDate`
 * instead, because "3 days ago" is the useful reading there.
 *
 * Accepts what the API returns (ISO strings) as well as the plainer
 * `YYYY-MM-DD HH:mm` form, and returns an em dash for anything unparseable so
 * a bad value never renders as `Invalid Date`.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
