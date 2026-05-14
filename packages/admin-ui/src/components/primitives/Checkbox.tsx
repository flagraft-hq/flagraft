import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  label?: string;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  label,
  disabled = false,
}: CheckboxProps) {
  const handleChange = () => {
    onChange(!checked);
  };

  const ariaChecked = indeterminate ? 'mixed' : checked ? 'true' : 'false';

  return (
    <div className="checkbox-wrapper">
      <button
        role="checkbox"
        aria-checked={ariaChecked}
        aria-label={label}
        disabled={disabled}
        className={`checkbox ${checked ? 'checked' : ''} ${indeterminate ? 'indeterminate' : ''}`}
        onClick={handleChange}
      >
        <span className="checkbox-box">
          {checked && <span className="checkbox-icon">✓</span>}
          {indeterminate && <span className="checkbox-icon">−</span>}
        </span>
        {label && <span className="checkbox-label">{label}</span>}
      </button>
    </div>
  );
}
