import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Table } from '@heroui/react'
import type { Selection, SortDescriptor } from 'react-aria-components'
import { useProject } from '../../contexts/ProjectContext'
import { useFlags } from '../../hooks/useFlags'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { SortField, SortDir } from '../../hooks/useFlags'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../hooks/useToast'
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
import type { Flag, StateFilter } from '../../lib/types'

const ENV_NAMES = ['development', 'production']

/** Rows per page before the user picks a different size. */
const DEFAULT_PAGE_SIZE = 25

/** The columns the table lets you sort by, keyed to the API's sort fields. */
const SORTABLE: Record<string, SortField> = { name: 'name', updated: 'updated' }

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
  const toast = useToast()
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

  /**
   * Sorting is done by the API, so the descriptor only reflects what was asked
   * for -- the table must not reorder the page it was handed.
   */
  const sortDescriptor: SortDescriptor = {
    column: sortField,
    direction: sortDir === 'asc' ? 'ascending' : 'descending',
  }

  function clearFilters() {
    setSearch('')
    setStateFilter(null)
  }

  /** "Select all" arrives as the string `all` rather than a set of keys. */
  function handleSelectionChange(keys: Selection) {
    setSelectedKeys(keys === 'all' ? flags.map((f) => f.key) : Array.from(keys, String))
  }

  function handleSortChange(descriptor: SortDescriptor) {
    const next = SORTABLE[String(descriptor.column)]
    if (!next) return
    setSortField(next)
    setSortDir(descriptor.direction === 'ascending' ? 'asc' : 'desc')
  }

  async function handleToggle(key: string, env: string, enabled: boolean) {
    try {
      const res = await flagsApi.toggle(projectId, key, env, enabled)
      if (res.data.pending) {
        toast.push({
          title: `Waiting on a second admin to confirm this change in ${env}`,
          variant: 'default',
        })
      }
      refetch()
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Failed to update flag')
    }
  }

  return (
    <div className="flags-screen dc">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Feature flags</h1>
          <p className="page-header-sub">
            Toggle, target, and roll out behavior across different environments.
          </p>
        </div>
        <div className="page-header-actions">
          <Button variant="ghost" onClick={refetch}>
            <Icon name="refresh" size={14} />
            Refresh
          </Button>
          <Denied when={!canWrite} reason="Your role is read-only">
            <Button variant="primary" isDisabled={!canWrite} onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={14} />
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
        <div className="flags-empty dc-empty">
          <Icon name="flag" size={48} className="flags-empty-icon" />
          <h2 className="flags-empty-title">No flags yet</h2>
          <p className="flags-empty-message">Create your first feature flag to get started.</p>
        </div>
      ) : total === 0 ? (
        <div className="flags-empty dc-empty">
          <Icon name="search" size={48} className="flags-empty-icon" />
          <h2 className="flags-empty-title">No flags match your filters</h2>
          <p className="flags-empty-message">Try adjusting your search or filters.</p>
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="flags-list dc-card">
          <Table>
            <Table.Content
              aria-label="Feature flags"
              selectionMode="multiple"
              selectedKeys={selectedKeys}
              onSelectionChange={handleSelectionChange}
              sortDescriptor={sortDescriptor}
              onSortChange={handleSortChange}
            >
              <Table.Header>
                <Table.Column id="select" className="cell-check">
                  <Checkbox slot="selection" aria-label="Select all flags">
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Column>
                <Table.Column id="name" isRowHeader allowsSorting>
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>
                      Flag
                    </Table.SortableColumnHeader>
                  )}
                </Table.Column>
                {ENV_NAMES.map((env) => (
                  <Table.Column key={env} id={env} className="cell-env">
                    <span className="env-label">
                      {nameFor(env)}
                      {env === 'production' && <span className="live-dot" aria-hidden="true" />}
                    </span>
                  </Table.Column>
                ))}
                <Table.Column id="updated" allowsSorting className="cell-edited">
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>
                      Last edited
                    </Table.SortableColumnHeader>
                  )}
                </Table.Column>
              </Table.Header>
              <Table.Body items={flags}>
                {(flag: Flag) => (
                  <FlagRow
                    flag={flag}
                    activeEnv={activeEnv}
                    envNames={ENV_NAMES}
                    stale={isFlagStale(flag.updated, staleFlagDays)}
                    onToggle={(key, env, enabled) => {
                      void handleToggle(key, env, enabled)
                    }}
                    onClick={(key) => navigate(`/flags/${key}`)}
                  />
                )}
              </Table.Body>
            </Table.Content>
          </Table>
          <div className="dc-table-foot">
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
