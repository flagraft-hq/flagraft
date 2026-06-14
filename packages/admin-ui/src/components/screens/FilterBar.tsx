import { Icon } from '../primitives/Icon'
import { Kbd } from '../primitives/Kbd'
import type { StateFilter } from '../../lib/types'

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  /** Top tags by frequency, as [tag, count] pairs. */
  topTags: [string, number][]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  stateFilter: StateFilter
  onStateFilterChange: (filter: StateFilter) => void
  resultCount: number
  totalCount: number
  onClearAll: () => void
}

const STATE_OPTIONS: {
  value: Exclude<StateFilter, null>
  label: string
  tone?: 'amber' | 'red'
  icon?: 'shield'
}[] = [
  { value: 'on', label: 'on anywhere' },
  { value: 'off', label: 'off everywhere' },
  { value: 'overrides', label: 'has overrides', tone: 'amber' },
  { value: 'kill-switch', label: 'kill switches', tone: 'red', icon: 'shield' },
]

export function FilterBar({
  search,
  onSearchChange,
  topTags,
  selectedTags,
  onTagsChange,
  stateFilter,
  onStateFilterChange,
  resultCount,
  totalCount,
  onClearAll,
}: FilterBarProps) {
  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  const anyFilters = search.trim() !== '' || selectedTags.length > 0 || stateFilter !== null

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

      {topTags.length > 0 && (
        <div className="chip-group filter-tags" role="group" aria-label="Tag filters">
          {topTags.map(([tag, count]) => (
            <button
              key={tag}
              className="chip"
              aria-pressed={selectedTags.includes(tag)}
              onClick={() => toggleTag(tag)}
            >
              <span>{tag}</span>
              <span className="chip-n num">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="chip-group" role="group" aria-label="State filter">
        {STATE_OPTIONS.map(({ value, label, tone, icon }) => (
          <button
            key={value}
            className="chip"
            data-tone={tone}
            aria-pressed={stateFilter === value}
            onClick={() => onStateFilterChange(stateFilter === value ? null : value)}
          >
            {icon && <Icon name={icon} size={11} />}
            {label}
          </button>
        ))}
      </div>

      <span className="filters-spacer" />

      {anyFilters && (
        <button className="btn ghost sm filters-clear" onClick={onClearAll}>
          Clear all <Icon name="x" size={11} />
        </button>
      )}
      <span className="filters-count num">
        {anyFilters
          ? `${resultCount} of ${totalCount}`
          : `${resultCount} flag${resultCount === 1 ? '' : 's'}`}
      </span>
    </div>
  )
}
