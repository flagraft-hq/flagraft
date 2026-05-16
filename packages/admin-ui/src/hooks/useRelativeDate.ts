const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function useRelativeDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'

  /**
   * Parse the date string -- supports 'YYYY-MM-DD HH:mm' or 'YYYY-MM-DD'
   * Append 'Z' to treat datetime strings as UTC (date-only strings are already UTC in Date constructor)
   */
  const normalized = dateStr.replace(' ', 'T')
  const withTz =
    normalized.includes('T') && !normalized.endsWith('Z') ? normalized + 'Z' : normalized
  const parsed = new Date(withTz)
  if (isNaN(parsed.getTime())) return '—'

  const now = Date.now()
  const diffMs = now - parsed.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 7) return `${diffDays} days ago`

  const month = MONTH_NAMES[parsed.getUTCMonth()]
  const day = parsed.getUTCDate()
  return `${month} ${day}`
}
