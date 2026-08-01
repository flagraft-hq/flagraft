import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext'
import { useFlags } from '../../hooks/useFlags'
import type { SortField, SortDir } from '../../hooks/useFlags'
import { Button } from '../primitives/Button'
import { Checkbox } from '../primitives/Checkbox'
import { ErrorState } from '../primitives/ErrorState'
import { Icon } from '../primitives/Icon'
import { FilterBar } from './FilterBar'
import { FlagRow } from './FlagRow'
import { FlagBulkActionBar } from './FlagBulkActionBar'
import { CreateFlagModal } from './CreateFlagModal'
import { flagsApi } from '../../lib/api'
import { isFlagStale } from '../../lib/stale'
import type { Flag, StateFilter } from '../../lib/types'

const ENV_NAMES = ['development', 'production']

/** Returns whether a flag passes the currently selected state-filter chip. */
function matchesStateFilter(flag: Flag, filter: StateFilter): boolean {
  if (!filter) return true
  const states = Object.values(flag.state ?? {})
  switch (filter) {
    case 'on':
      return states.some((s) => s.on)
    case 'off':
      return states.every((s) => !s.on)
    case 'kill-switch':
      return (flag.tags ?? []).includes('kill-switch')
    default:
      return true
  }
}

/** A sortable column header used in the flags list head row. */
function SortHead({
  label,
  col,
  sortField,
  sortDir,
  onSort,
  align,
}: {
  label: string
  col: SortField
  sortField: SortField
  sortDir: SortDir
  onSort: (col: SortField) => void
  align?: 'right'
}) {
  const active = sortField === col
  return (
    <button
      className={`sort-head${align === 'right' ? ' sort-head-right' : ''}${active ? ' active' : ''}`}
      onClick={() => onSort(col)}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <Icon
        name="chevronDown"
        size={12}
        className={`sort-arrow${active && sortDir === 'asc' ? ' sort-arrow-up' : ''}`}
      />
    </button>
  )
}

export function FlagsScreen() {
  const { activeProject } = useProject()

  if (!activeProject) {
    return <div className="flags-empty-project">No project selected</div>
  }

  return <FlagsScreenInner projectId={activeProject.id} />
}

function FlagsScreenInner({ projectId }: { projectId: string }) {
  const { activeEnv, environments, activeProject } = useProject()
  const staleFlagDays = activeProject?.settings?.flagDefaults?.staleFlagDays
  /**
   * The flags list shows the development and production columns by design.
   * Their labels come from the real environment names so renames show here too.
   * ponytail: fixed two columns; revisit if the list needs to scale to N envs.
   */
  const nameFor = (slug: string) => environments.find((e) => e.slug === slug)?.name ?? slug
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [stateFilter, setStateFilter] = useState<StateFilter>(null)
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

  /** Top 5 tags by frequency, surfaced as quick filter chips. */
  const topTags = useMemo<[string, number][]>(() => {
    const counts: Record<string, number> = {}
    rawFlags.forEach((f) => (f.tags ?? []).forEach((t) => (counts[t] = (counts[t] ?? 0) + 1)))
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [rawFlags])

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

  const filteredFlags = rawFlags.filter((f) => matchesStateFilter(f, stateFilter))
  const anyFilters = search !== '' || selectedTags.length > 0 || stateFilter !== null
  const allSelected =
    filteredFlags.length > 0 && filteredFlags.every((f) => selectedKeys.includes(f.key))
  const someSelected = selectedKeys.length > 0 && !allSelected

  function clearFilters() {
    setSearch('')
    setSelectedTags([])
    setStateFilter(null)
  }

  function handleSelect(key: string, selected: boolean) {
    setSelectedKeys((prev) =>
      selected ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key),
    )
  }

  function handleSelectAll(checked: boolean) {
    setSelectedKeys(checked ? filteredFlags.map((f) => f.key) : [])
  }

  function handleSortCol(col: SortField) {
    if (sortField === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(col)
      setSortDir(col === 'updated' ? 'desc' : 'asc')
    }
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
      <div className="page-header">
        <div className="page-header-text">
          <h1>Feature flags</h1>
          <p className="page-header-sub">
            Toggle, target, and roll out behavior across different environments.
          </p>
        </div>
        <div className="page-header-actions">
          <Button variant="ghost" leftIcon="refresh" onClick={refetch}>
            Refresh
          </Button>
          <Button variant="primary" leftIcon="plus" onClick={() => setShowCreate(true)}>
            New flag
          </Button>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        topTags={topTags}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        resultCount={filteredFlags.length}
        totalCount={rawFlags.length}
        onClearAll={clearFilters}
      />

      <FlagBulkActionBar
        selectedKeys={selectedKeys}
        projectId={projectId}
        activeEnv={activeEnv}
        onDone={() => {
          setSelectedKeys([])
          refetch()
        }}
        onCancel={() => setSelectedKeys([])}
      />

      {toggleError && (
        <div className="flags-toggle-error">
          {toggleError}
          <button onClick={() => setToggleError(null)} aria-label="Dismiss">
            x
          </button>
        </div>
      )}

      {rawFlags.length === 0 && !anyFilters ? (
        <div className="flags-empty">
          <Icon name="flag" size={48} className="flags-empty-icon" />
          <h2 className="flags-empty-title">No flags yet</h2>
          <p className="flags-empty-message">Create your first feature flag to get started.</p>
        </div>
      ) : filteredFlags.length === 0 ? (
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
          <div className="flags-row flags-head">
            <div className="cell-check">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
                ariaLabel="Select all flags"
              />
            </div>
            <SortHead
              label="Flag"
              col="name"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSortCol}
            />
            <div className="cell-env">
              <span className="env-label">{nameFor('development')}</span>
            </div>
            <div className="cell-env cell-env-prod">
              <span className="env-label">
                {nameFor('production')}
                <span className="live-dot" aria-hidden="true" />
              </span>
            </div>
            <SortHead
              label="Last edited"
              col="updated"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSortCol}
              align="right"
            />
          </div>
          {filteredFlags.map((flag) => (
            <FlagRow
              key={flag.key}
              flag={flag}
              activeEnv={activeEnv}
              envNames={ENV_NAMES}
              selected={selectedKeys.includes(flag.key)}
              stale={isFlagStale(flag.updated, staleFlagDays)}
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
