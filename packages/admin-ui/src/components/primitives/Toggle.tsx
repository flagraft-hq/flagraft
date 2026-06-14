import { useState } from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  variant?: 'default' | 'production'
  /** Visual size of the toggle track. Defaults to 'default' (36×20 px). */
  size?: 'sm' | 'default' | 'lg'
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  variant = 'default',
  size = 'default',
}: ToggleProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleToggle = () => {
    if (variant === 'production') {
      setShowConfirm(true)
    } else {
      onChange(!checked)
      setShowConfirm(false)
    }
  }

  const handleConfirm = () => {
    onChange(!checked)
    setShowConfirm(false)
  }

  /**
   * Build track class list: base + optional size modifier.
   * 'default' size needs no extra class — the base .toggle-track
   * already defines the default (36×20) dimensions.
   */
  const trackClass = [
    'toggle-track',
    size === 'sm' ? 'track-sm' : size === 'lg' ? 'track-lg' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="toggle-wrapper">
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label ?? (checked ? 'Enabled' : 'Disabled')}
        disabled={disabled}
        className={`toggle toggle-${checked ? 'on' : 'off'}`}
        data-variant={variant}
        onClick={handleToggle}
      >
        <span className={trackClass}>
          <span className="toggle-thumb" />
        </span>
        {label && <span className="toggle-label">{label}</span>}
      </button>
      {showConfirm && (
        <div className="toggle-confirm">
          <span>{checked ? 'Disable' : 'Enable'} production toggle?</span>
          <button className="confirm-yes" onClick={handleConfirm}>
            Yes
          </button>
          <button className="confirm-no" onClick={() => setShowConfirm(false)}>
            No
          </button>
        </div>
      )}
    </div>
  )
}
