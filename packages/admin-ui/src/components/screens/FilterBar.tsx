import { Icon } from '../primitives/Icon'
import { Kbd } from '../primitives/Kbd'
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

const STATE_OPTIONS: { value: Exclude<StateFilter, null>; label: string }[] = [
  { value: 'on', label: 'on' },
  { value: 'off', label: 'off' },
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
    <div className="filters-bar">
      <div className="search-input">
        <Icon name="search" size={14} className="search-ico" />
        <input
          className="filter-search"
          placeholder="Search by name, key, description…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <span className="kbd-hint">
          <Kbd keys={['/']} />
        </span>
      </div>

      <div className="chip-group" role="group" aria-label={`State filter for ${envName}`}>
        {STATE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            className="chip"
            aria-pressed={stateFilter === value}
            onClick={() => onStateFilterChange(stateFilter === value ? null : value)}
          >
            {label} in {envName}
          </button>
        ))}
      </div>

      <span className="filters-spacer" />

      {anyFilters && (
        <button className="btn ghost sm filters-clear" onClick={onClearAll}>
          Clear all <Icon name="x" size={11} />
        </button>
      )}
    </div>
  )
}
