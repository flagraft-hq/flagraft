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
  hint?: React.ReactNode
  /**
   * Text of the disabled first option shown while value is ''.
   * Pass '' to omit it entirely (for filters that always have a value).
   */
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      value,
      onChange,
      disabled,
      error,
      hint,
      placeholder = 'Select…',
      className = '',
      id,
      ...rest
    },
    ref,
  ) => {
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
          className={`select-input ${className}`.trim()}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {hint && !error && <span className="text-field-hint">{hint}</span>}
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
