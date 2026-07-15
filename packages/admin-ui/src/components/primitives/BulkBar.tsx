import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface BulkBarProps {
  /** Number of selected items; the bar renders nothing when it is 0. */
  count: number
  /** Clears the selection via the trailing × button; omitted → no button. */
  onClear?: () => void
  /** Disables the × button while a bulk action is running. */
  busy?: boolean
  children: ReactNode
}

/**
 * Shared shell for the floating bulk-selection bar: the "N selected" count,
 * the action controls passed as children, and the clear-selection button.
 * The actions themselves are domain-specific (see FlagBulkActionBar for flags
 * and UserBulkActionBar for users).
 */
export function BulkBar({ count, onClear, busy, children }: BulkBarProps) {
  if (count === 0) return null
  return (
    <div className="bulk-bar">
      <span className="bulk-count">
        <span className="num">{count}</span> selected
      </span>
      {children}
      {onClear ? (
        <button
          className="bulk-close"
          onClick={onClear}
          aria-label="Clear selection"
          disabled={busy}
        >
          <Icon name="x" size={14} />
        </button>
      ) : null}
    </div>
  )
}

/** Thin vertical divider between groups of bulk actions. */
export function BulkSep() {
  return <span className="bulk-sep" />
}
