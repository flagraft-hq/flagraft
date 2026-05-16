interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  availableTags: string[]
  stateFilter: 'all' | 'on' | 'off'
  onStateFilterChange: (filter: 'all' | 'on' | 'off') => void
}

export function FilterBar({
  search,
  onSearchChange,
  selectedTags,
  onTagsChange,
  availableTags,
  stateFilter,
  onStateFilterChange,
}: FilterBarProps) {
  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  return (
    <div className="filter-bar">
      <input
        className="filter-search"
        placeholder="Search flags..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="filter-state-buttons">
        <button
          className={
            stateFilter === 'all' ? 'filter-state-btn filter-state-btn-active' : 'filter-state-btn'
          }
          onClick={() => onStateFilterChange('all')}
        >
          All
        </button>
        <button
          className={
            stateFilter === 'on' ? 'filter-state-btn filter-state-btn-active' : 'filter-state-btn'
          }
          onClick={() => onStateFilterChange('on')}
        >
          On
        </button>
        <button
          className={
            stateFilter === 'off' ? 'filter-state-btn filter-state-btn-active' : 'filter-state-btn'
          }
          onClick={() => onStateFilterChange('off')}
        >
          Off
        </button>
      </div>
      {availableTags.length > 0 && (
        <div className="filter-tags">
          {availableTags.map((t) => (
            <button
              key={t}
              className={selectedTags.includes(t) ? 'tag-chip tag-chip-active' : 'tag-chip'}
              onClick={() => toggleTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
