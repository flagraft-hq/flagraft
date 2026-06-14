import { Icon } from './Icon'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  indeterminate?: boolean
  label?: string
  /**
   * Accessible name applied when there should be no visible label text
   * (e.g. a row-select checkbox in a dense table). Ignored if `label` is set.
   */
  ariaLabel?: string
  disabled?: boolean
}

export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  label,
  ariaLabel,
  disabled = false,
}: CheckboxProps) {
  const handleChange = () => {
    onChange(!checked)
  }

  const ariaChecked = indeterminate ? 'mixed' : checked ? 'true' : 'false'

  return (
    <div className="checkbox-wrapper">
      <button
        role="checkbox"
        aria-checked={ariaChecked}
        aria-label={label ?? ariaLabel}
        disabled={disabled}
        className={`checkbox ${checked ? 'checked' : ''} ${indeterminate ? 'indeterminate' : ''}`}
        onClick={handleChange}
      >
        <span className="checkbox-box">
          {/**
           * Render an Icon glyph when the box is active so the SVG
           * picks up the `color` set by CSS (.checkbox-icon svg).
           * `check` is shown for the checked state; `minus` for indeterminate.
           */}
          {(checked || indeterminate) && (
            <span className="checkbox-icon">
              <Icon name={indeterminate ? 'minus' : 'check'} size={11} />
            </span>
          )}
        </span>
        {label && <span className="checkbox-label">{label}</span>}
      </button>
    </div>
  )
}
