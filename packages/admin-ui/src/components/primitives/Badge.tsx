import { ReactNode } from 'react'

/**
 * Maps the public variant names to the design tone class names.
 * "success" maps to teal because the design palette has no green tone.
 */
const VARIANT_TONE: Record<string, string> = {
  default: 'badge-default',
  primary: 'badge-primary',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
}

interface BadgeProps {
  /** Controls the color tone of the badge. */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  /** When true, renders a small leading dot whose color matches the variant tone. */
  dot?: boolean
  /** When true, switches the badge label to a monospace font. */
  mono?: boolean
  className?: string
  children: ReactNode
}

/**
 * A small inline label used to display statuses, categories, or counts.
 * Supports five color variants, an optional leading dot, and a mono font modifier.
 */
export function Badge({
  variant = 'default',
  dot = false,
  mono = false,
  className = '',
  children,
}: BadgeProps) {
  const toneClass = VARIANT_TONE[variant] ?? VARIANT_TONE.default
  const classes = ['badge', toneClass, mono ? 'badge-mono' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  )
}
