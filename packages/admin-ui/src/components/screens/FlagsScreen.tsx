import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext'
import { useFlags } from '../../hooks/useFlags'
import type { SortField, SortDir } from '../../hooks/useFlags'
import { Button } from '../primitives/Button'
import { ErrorState } from '../primitives/ErrorState'
import { Icon } from '../primitives/Icon'
import { FilterBar } from './FilterBar'
import { FlagRow } from './FlagRow'
import { BulkActionBar } from './BulkActionBar'
import { CreateFlagModal } from './CreateFlagModal'
import { flagsApi } from '../../lib/api'

const ENV_NAMES = ['development', 'staging', 'production']

const SORT_FIELDS: { label: string; value: SortField }[] = [
  { label: 'Name', value: 'name' },
  { label: 'Updated', value: 'updated' },
  { label: 'Key', value: 'key' },
]

export function FlagsScreen() {
  const { activeProject } = useProject()

  if (!activeProject) {
    return <div className="flags-empty-project">No project selected</div>
  }

  return <FlagsScreenInner projectId={activeProject.id} />
}

function FlagsScreenInner({ projectId }: { projectId: string }) {
  const { activeEnv } = useProject()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [stateFilter, setStateFilter] = useState<'all' | 'on' | 'off'>('all')
  const [sortField, setSortField] = useState<SortField>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const {
    flags: rawFlags,
    loading,
    error,
    refetch,
  } = useFlags({
    projectId,
    search,
    tags: selectedTags,
    sortField,
    sortDir,
  })

  if (loading) {
    return (
      <div className="flags-loading">
        <span>Loading...</span>
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load flags" message={error} onRetry={refetch} />
  }

  const availableTags = Array.from(new Set(rawFlags.flatMap((f) => f.tags)))

  const filteredFlags =
    stateFilter === 'all'
      ? rawFlags
      : rawFlags.filter((f) => {
          const on = f.state[activeEnv]?.on ?? false
          return stateFilter === 'on' ? on : !on
        })

  function clearFilters() {
    setSearch('')
    setSelectedTags([])
    setStateFilter('all')
  }

  function handleSelect(key: string, selected: boolean) {
    setSelectedKeys((prev) =>
      selected ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key),
    )
  }

  async function handleToggle(key: string, env: string, enabled: boolean) {
    try {
      await flagsApi.toggle(projectId, key, env, enabled)
      refetch()
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Failed to update flag')
    }
  }

  return (
    <div className="flags-screen">
      <div className="flags-header">
        <h1>Feature Flags</h1>
        <Button variant="primary" leftIcon="plus" onClick={() => setShowCreate(true)}>
          New Flag
        </Button>
      </div>
      <span className="flags-count">{filteredFlags.length} flags</span>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        availableTags={availableTags}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
      />
      <div className="sort-bar">
        <span className="sort-label">Sort:</span>
        {SORT_FIELDS.map(({ label, value }) => (
          <button
            key={value}
            className={`sort-btn${sortField === value ? ' sort-btn-active' : ''}`}
            onClick={() => setSortField(value)}
          >
            {label}
          </button>
        ))}
        <button
          className="sort-dir-btn"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
        >
          {sortDir === 'asc' ? 'Asc' : 'Desc'}
        </button>
      </div>
      <BulkActionBar
        selectedKeys={selectedKeys}
        projectId={projectId}
        activeEnv={activeEnv}
        onDone={() => {
          setSelectedKeys([])
          refetch()
        }}
      />
      {toggleError && (
        <div className="flags-toggle-error">
          {toggleError}
          <button onClick={() => setToggleError(null)} aria-label="Dismiss">
            x
          </button>
        </div>
      )}
      {rawFlags.length === 0 &&
      search === '' &&
      selectedTags.length === 0 &&
      stateFilter === 'all' ? (
        <div className="flags-empty">
          <Icon name="flag" size={48} className="flags-empty-icon" />
          <h2 className="flags-empty-title">No flags yet</h2>
          <p className="flags-empty-message">Create your first feature flag to get started.</p>
        </div>
      ) : rawFlags.length > 0 && filteredFlags.length === 0 ? (
        <div className="flags-empty">
          <Icon name="search" size={48} className="flags-empty-icon" />
          <h2 className="flags-empty-title">No flags match your filters</h2>
          <p className="flags-empty-message">Try adjusting your search or filters.</p>
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="flags-list">
          {filteredFlags.map((flag) => (
            <FlagRow
              key={flag.key}
              flag={flag}
              activeEnv={activeEnv}
              envNames={ENV_NAMES}
              selected={selectedKeys.includes(flag.key)}
              onSelect={handleSelect}
              onToggle={(key, env, enabled) => {
                void handleToggle(key, env, enabled)
              }}
              onClick={(key) => navigate(`/flags/${key}`)}
            />
          ))}
        </div>
      )}
      <CreateFlagModal
        open={showCreate}
        projectId={projectId}
        onClose={() => setShowCreate(false)}
      />
    </div>
  )
}
