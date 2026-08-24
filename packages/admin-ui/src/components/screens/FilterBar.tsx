import { SearchField } from '@heroui/react'
import { Kbd } from '../primitives/Kbd'
import { Icon } from '../primitives/Icon'
import type { StateFilter } from '../../lib/types'

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  stateFilter: StateFilter
  onStateFilterChange: (filter: StateFilter) => void
  /** Name of the environment the state filter applies to. */
  envName: string
  onClearAll: () => void
}

const STATE_OPTIONS: { value: StateFilter; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'on', label: 'Enabled' },
  { value: 'off', label: 'Disabled' },
]

export function FilterBar({
  search,
  onSearchChange,
  stateFilter,
  onStateFilterChange,
  envName,
  onClearAll,
}: FilterBarProps) {
  const anyFilters = search.trim() !== '' || stateFilter !== null

  return (
    <div className="filters-bar dc-toolbar">
      <SearchField aria-label="Search flags" value={search} onChange={onSearchChange} className="search-pill">
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Filter by name or key..." />
          <span className="kbd-hint">
            <Kbd keys={['/']} />
          </span>
        </SearchField.Group>
      </SearchField>

      <div className="dc-chip-group" role="group" aria-label={`State filter for ${envName}`}>
        {STATE_OPTIONS.map(({ value, label }) => (
          <button
            key={value ?? 'all'}
            type="button"
            className="dc-chip"
            aria-pressed={stateFilter === value}
            onClick={() => onStateFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <span className="filters-spacer" />

      {anyFilters && (
        <button type="button" className="filters-clear" onClick={onClearAll}>
          Clear all <Icon name="x" size={11} />
        </button>
      )}
    </div>
  )
}
