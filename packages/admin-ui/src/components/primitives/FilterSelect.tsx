import { ListBox, Select } from '@heroui/react'

export interface FilterSelectOption {
  value: string
  label: string
}

interface FilterSelectProps {
  /** Accessible name for the trigger; also used by tests to find it. */
  label: string
  value: string
  onChange: (next: string) => void
  options: FilterSelectOption[]
  isDisabled?: boolean
  /** Shown on the trigger when `value` matches no option -- an action picker. */
  placeholder?: string
  className?: string
}

/**
 * A HeroUI select over a fixed list of options, driven by a plain string.
 *
 * HeroUI's Select is a button plus a listbox, not a native `<select>`, and it
 * wants a `selectedKey`. Every screen that had a `<Select>` needs the same
 * five-element scaffold around it, so it lives here once.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  isDisabled,
  placeholder,
  className,
}: FilterSelectProps) {
  return (
    <Select
      className={className}
      aria-label={label}
      selectedKey={value === '' ? null : value}
      onSelectionChange={(key) => onChange(key === null ? '' : String(key))}
      isDisabled={isDisabled}
      placeholder={placeholder}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="dc-popover">
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.value} id={o.value}>
              {o.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
