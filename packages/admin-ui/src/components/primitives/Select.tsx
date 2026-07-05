import React, { useMemo } from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  error?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, value, onChange, disabled, error, id, ...rest }, ref) => {
    const selectId = useMemo(
      () =>
        id ||
        `select-${crypto.getRandomValues(new Uint8Array(6)).reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '')}`,
      [id],
    )

    const errorId = `${selectId}-error`

    return (
      <div className={`select-wrapper ${error ? 'error' : ''}`}>
        {label && (
          <label className="select-label" htmlFor={selectId}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className="select-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        >
          <option value="" disabled>
            Select...
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <span id={errorId} className="select-error" aria-live="polite">
            {error}
          </span>
        )}
      </div>
    )
  },
)

Select.displayName = 'Select'
