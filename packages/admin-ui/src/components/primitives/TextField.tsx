import React from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  onChange: (value: string) => void;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, onChange, value, className = '', id, ...rest }, ref) => {
    const fieldId = id || `text-field-${Math.random().toString(36).substr(2, 9)}`;

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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
        {hint && !error && <span className="text-field-hint">{hint}</span>}
        {error && <span className="text-field-error">{error}</span>}
      </div>
    );
  }
);

TextField.displayName = 'TextField';
