import React, { useMemo } from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  onChange: (value: string) => void;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, onChange, value, className = '', id, ...rest }, ref) => {
    const fieldId = useMemo(
      () => id || `text-field-${crypto.getRandomValues(new Uint8Array(6)).reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '')}`,
      [id]
    );

    const hintId = `${fieldId}-hint`;
    const errorId = `${fieldId}-error`;

    const describedByIds = [
      hint && !error ? hintId : null,
      error ? errorId : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={`text-field ${error ? 'error' : ''}`}>
        {label && (
          <label className="text-field-label" htmlFor={fieldId}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={fieldId}
          className="text-field-input"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedByIds || undefined}
          {...rest}
        />
        {hint && !error && (
          <span id={hintId} className="text-field-hint">
            {hint}
          </span>
        )}
        {error && (
          <span id={errorId} className="text-field-error" aria-live="polite">
            {error}
          </span>
        )}
      </div>
    );
  }
);

TextField.displayName = 'TextField';
