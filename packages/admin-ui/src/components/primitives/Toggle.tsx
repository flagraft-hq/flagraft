import React, { useState } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  variant?: 'default' | 'production';
}

export function Toggle({ checked, onChange, label, disabled = false, variant = 'default' }: ToggleProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = () => {
    if (variant === 'production' && !checked) {
      setShowConfirm(true);
    } else {
      onChange(!checked);
      setShowConfirm(false);
    }
  };

  const handleConfirm = () => {
    onChange(true);
    setShowConfirm(false);
  };

  return (
    <div className="toggle-wrapper">
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`toggle toggle-${checked ? 'on' : 'off'}`}
        data-variant={variant}
        onClick={handleToggle}
      >
        <span className="toggle-track">
          <span className="toggle-thumb" />
        </span>
        {label && <span className="toggle-label">{label}</span>}
      </button>
      {showConfirm && (
        <div className="toggle-confirm">
          <span>Enable production toggle?</span>
          <button className="confirm-yes" onClick={handleConfirm}>Yes</button>
          <button className="confirm-no" onClick={() => setShowConfirm(false)}>No</button>
        </div>
      )}
    </div>
  );
}
