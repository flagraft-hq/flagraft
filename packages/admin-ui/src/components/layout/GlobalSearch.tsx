import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { flagsApi, usersApi } from '../../lib/api'
import type { WorkspaceUser } from '../../lib/api'
import type { Flag } from '../../lib/types'
import { useProject } from '../../contexts/ProjectContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { Icon } from '../primitives/Icon'
import { Kbd } from '../primitives/Kbd'

/** Input is debounced this long before results update. */
const DEBOUNCE_MS = 250
/** Source lists are refetched at most once per this window (throttle). */
const FETCH_THROTTLE_MS = 15_000

interface SearchHit {
  kind: 'flag' | 'user'
  id: string
  primary: string
  secondary: string
  to: string
}

interface SourceCache {
  projectId: string
  fetchedAt: number
  flags: Flag[]
  users: WorkspaceUser[]
}

/**
 * Topbar search over flags (name, key, tags) and users (name, email).
 * Typing is debounced; the flag/user lists are fetched lazily and refetched
 * at most once per throttle window. Results are keyboard-navigable.
 * ponytail: searches flags + users only; add API keys as sources
 * when someone actually asks for them.
 */
export function GlobalSearch() {
  const navigate = useNavigate()
  const { activeProject } = useProject()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const cacheRef = useRef<SourceCache | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS)

  useEffect(() => {
    let cancelled = false
    if (!debouncedQuery) {
      setHits([])
      setLoading(false)
      return
    }

    async function search() {
      const projectId = activeProject?.id ?? ''
      const cache = cacheRef.current
      const stale =
        !cache || cache.projectId !== projectId || Date.now() - cache.fetchedAt > FETCH_THROTTLE_MS
      if (stale) {
        setLoading(true)
        /** Users may 403 for non-admin sessions; show whatever is allowed. */
        const [flagsRes, usersRes] = await Promise.allSettled([
          projectId ? flagsApi.list(projectId) : Promise.reject(new Error('no project')),
          usersApi.list(),
        ])
        cacheRef.current = {
          projectId,
          fetchedAt: Date.now(),
          flags: flagsRes.status === 'fulfilled' ? flagsRes.value.data : [],
          users: usersRes.status === 'fulfilled' ? usersRes.value.data : [],
        }
      }
      if (cancelled) return

      const q = debouncedQuery.toLowerCase()
      const { flags, users } = cacheRef.current!
      const flagHits: SearchHit[] = flags
        .filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.key.toLowerCase().includes(q) ||
            f.tags.some((t) => t.toLowerCase().includes(q)),
        )
        .slice(0, 8)
        .map((f) => ({
          kind: 'flag',
          id: f.key,
          primary: f.name,
          secondary: f.key,
          to: `/flags/${f.key}`,
        }))
      const userHits: SearchHit[] = users
        .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
        .slice(0, 5)
        .map((u) => ({
          kind: 'user',
          id: u.id,
          primary: u.name,
          secondary: u.email,
          /** Deep link: UsersScreen opens this user's drawer and drops the param. */
          to: `/users?user=${u.id}`,
        }))
      setHits([...flagHits, ...userHits])
      setActiveIndex(0)
      setLoading(false)
    }

    void search()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, activeProject?.id])

  function close() {
    setOpen(false)
    setQuery('')
    setHits([])
  }

  function go(hit: SearchHit) {
    close()
    inputRef.current?.blur()
    navigate(hit.to)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      close()
      inputRef.current?.blur()
      return
    }
    if (!hits.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      /** Hits may still belong to the previous query while the debounce is
          pending; Enter must never open a result for text that was typed
          over. Clicks stay allowed — a click lands on a visible row. */
      if (query.trim() !== debouncedQuery) return
      go(hits[activeIndex])
    }
  }

  const showResults = open && query.trim().length > 0

  return (
    <div className="topbar-search">
      <Icon name="search" size={14} className="search-icon" />
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showResults}
        aria-controls="global-search-results"
        aria-activedescendant={
          showResults && hits[activeIndex] ? `search-hit-${hits[activeIndex].id}` : undefined
        }
        placeholder="Search flags, users..."
        aria-label="Search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
      />
      <span className="kbd-hint">
        <Kbd keys={['Cmd', 'K']} />
      </span>

      {showResults ? (
        <div
          className="search-results"
          id="global-search-results"
          role="listbox"
          /** Keep input focus so onBlur doesn't close before the click lands. */
          onMouseDown={(e) => e.preventDefault()}
        >
          {loading && hits.length === 0 ? (
            <div className="search-empty">Searching…</div>
          ) : hits.length === 0 ? (
            <div className="search-empty">No matches for “{query.trim()}”</div>
          ) : (
            hits.map((hit, i) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                id={`search-hit-${hit.id}`}
                role="option"
                aria-selected={i === activeIndex}
                className={'search-hit' + (i === activeIndex ? ' active' : '')}
                onClick={() => go(hit)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <Icon name={hit.kind === 'flag' ? 'flag' : 'user'} size={13} />
                <span className="search-hit-primary">{hit.primary}</span>
                <span className="search-hit-secondary mono">{hit.secondary}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
