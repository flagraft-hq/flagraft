import type { ReactNode } from 'react'

/**
 * A settings card with an optional titled header, a body, and an optional
 * footer bar. Mirrors the design's head / body / foot structure so every
 * section reads consistently.
 */
export function SettingsCard({
  title,
  sub,
  children,
  footer,
  className = '',
}: {
  title?: ReactNode
  sub?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className={`settings-card ${className}`.trim()}>
      {title ? (
        <div className="settings-card-head">
          <h3>{title}</h3>
          {sub ? <div className="settings-card-sub">{sub}</div> : null}
        </div>
      ) : null}
      <div className="settings-card-body">{children}</div>
      {footer ? <div className="settings-card-foot">{footer}</div> : null}
    </div>
  )
}

/**
 * One labelled row inside a card: a label + hint on the left, the control on
 * the right. Pass `full` to stack the control under the label full-width.
 */
export function SettingsRow({
  label,
  hint,
  children,
  full,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  full?: boolean
}) {
  return (
    <div className={`settings-row${full ? ' full' : ''}`}>
      <div className="settings-row-label">
        <div className="lbl">{label}</div>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  )
}

/**
 * Segmented control. Purely presentational buttons; the active option is
 * driven by `value` and reported through `onChange`.
 */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg-btn"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Small dashed note marking a section whose controls are not yet persisted. */
export function NotWiredNote({ children }: { children: ReactNode }) {
  return <div className="settings-note">{children}</div>
}
