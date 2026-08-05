import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../../contexts/ProjectContext'
import { useFlags } from '../../hooks/useFlags'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { SortField, SortDir } from '../../hooks/useFlags'
import { usePermissions } from '../../hooks/usePermissions'
import { Button } from '../primitives/Button'
import { Checkbox } from '../primitives/Checkbox'
import { Denied } from '../primitives/Denied'
import { ErrorState } from '../primitives/ErrorState'
import { Pagination } from '../primitives/Pagination'
import { Icon } from '../primitives/Icon'
import { FilterBar } from './FilterBar'
import { FlagRow } from './FlagRow'
import { FlagBulkActionBar } from './FlagBulkActionBar'
import { CreateFlagModal } from './CreateFlagModal'
import { flagsApi } from '../../lib/api'
import { isFlagStale } from '../../lib/stale'
import type { StateFilter } from '../../lib/types'

const ENV_NAMES = ['development', 'production']

/** Rows per page before the user picks a different size. */
const DEFAULT_PAGE_SIZE = 25

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
  const { canWrite } = usePermissions()
  const staleFlagDays = activeProject?.settings?.flagDefaults?.staleFlagDays
  /**
   * The flags list shows the development and production columns by design.
   * Their labels come from the real environment names so renames show here too.
   * ponytail: fixed two columns; revisit if the list needs to scale to N envs.
   */
  const nameFor = (slug: string) => environments.find((e) => e.slug === slug)?.name ?? slug
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>(null)
  const [sortField, setSortField] = useState<SortField>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  /** Typing must not fire a request per keystroke. */
  const debouncedSearch = useDebouncedValue(search, 300)

  const { flags, total, loading, error, refetch } = useFlags({
    projectId,
    search: debouncedSearch,
    stateFilter,
    env: activeEnv,
    sortField,
    sortDir,
    limit,
    offset,
  })

  /**
   * Any change to the filters or sort re-numbers the pages, so page 4 of the
   * old result set is meaningless. Go back to the first page.
   */
  useEffect(() => {
    setOffset((current) => (current === 0 ? current : 0))
  }, [debouncedSearch, stateFilter, activeEnv, sortField, sortDir, projectId])

  /** Selections are per-page; carrying them across pages would hide them. */
  useEffect(() => {
    setSelectedKeys((current) => (current.length === 0 ? current : []))
  }, [offset])

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

  const anyFilters = search !== '' || stateFilter !== null
  const allSelected = flags.length > 0 && flags.every((f) => selectedKeys.includes(f.key))
  const someSelected = selectedKeys.length > 0 && !allSelected

  function clearFilters() {
    setSearch('')
    setStateFilter(null)
  }

  function handleSelect(key: string, selected: boolean) {
    setSelectedKeys((prev) =>
      selected ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key),
    )
  }

  function handleSelectAll(checked: boolean) {
    setSelectedKeys(checked ? flags.map((f) => f.key) : [])
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
          <Denied when={!canWrite} reason="Your role is read-only">
            <Button
              variant="primary"
              leftIcon="plus"
              disabled={!canWrite}
              onClick={() => setShowCreate(true)}
            >
              New flag
            </Button>
          </Denied>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        envName={nameFor(activeEnv)}
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

      {total === 0 && !anyFilters ? (
        <div className="flags-empty">
          <Icon name="flag" size={48} className="flags-empty-icon" />
          <h2 className="flags-empty-title">No flags yet</h2>
          <p className="flags-empty-message">Create your first feature flag to get started.</p>
        </div>
      ) : total === 0 ? (
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
          {flags.map((flag) => (
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
          <div className="flags-list-foot">
            <Pagination
              total={total}
              limit={limit}
              offset={offset}
              onOffsetChange={setOffset}
              onLimitChange={(next) => {
                /** Page numbers change meaning with the size, so start over. */
                setLimit(next)
                setOffset(0)
              }}
              noun="flag"
            />
          </div>
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
