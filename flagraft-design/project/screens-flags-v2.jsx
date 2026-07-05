/* global React, Icon, Button, Toggle, Badge, Checkbox, Modal, useToast, PageHeader, Tip, Kbd, KbdHint, ProdConfirmModal, NewFlagModal */
const { useState, useMemo, useEffect, useRef } = React

// ============================================================
// SCREEN: Flags list — REDESIGNED
// ============================================================

// Author registry — turns raw key IDs into people.
const AUTHORS = {
  k_root: { name: 'Root admin', initials: 'RA', color: 'amber', role: 'service' },
  k_a91c: { name: 'Kochar S.', initials: 'KS', color: 'teal', role: 'admin' },
  k_2f10: { name: 'Marin Pé', initials: 'MP', color: 'violet', role: 'admin' },
}
function authorOf(id) {
  return (
    AUTHORS[id] || { name: id, initials: id.slice(2, 4).toUpperCase(), color: 'slate', role: 'key' }
  )
}

// Sort helpers
const SORT_KEYS = {
  name: (f) => f.name.toLowerCase(),
  key: (f) => f.key,
  updated: (f) => f.updated,
}

function cmpBy(col, dir) {
  const fn = SORT_KEYS[col] || SORT_KEYS.updated
  return (a, b) => {
    const av = fn(a),
      bv = fn(b)
    if (av === bv) return 0
    const r = av < bv ? -1 : 1
    return dir === 'asc' ? r : -r
  }
}

// Relative date for "Last edited"
function relDate(s) {
  // e.g. "2026-05-11 09:14"  vs today (May 13, 2026)
  const today = new Date('2026-05-13T12:00:00Z')
  const d = new Date(s.replace(' ', 'T') + 'Z')
  const diffDays = Math.floor((today - d) / 86400000)
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return diffDays + 'd ago'
  if (diffDays < 30) return Math.floor(diffDays / 7) + 'w ago'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function FlagsScreenV2({ activeEnv, onOpenFlag, openNew, setOpenNew }) {
  const [flags, setFlags] = useState(window.FLAGS)
  const [filter, setFilter] = useState('')
  const [activeTags, setActiveTags] = useState(new Set())
  const [stateFilter, setStateFilter] = useState(null) // null|'on'|'off'|'overrides'|'kill-switch'
  const [selected, setSelected] = useState({})
  const [confirmProd, setConfirmProd] = useState(null)
  const [sort, setSort] = useState({ col: 'updated', dir: 'desc' })
  const [tagAdd, setTagAdd] = useState(false)
  const toast = useToast()

  const topTags = useMemo(() => {
    const counts = {}
    flags.forEach((f) => f.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)))
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [flags])

  const filtered = useMemo(() => {
    let xs = [...flags]
    if (filter.trim()) {
      const q = filter.toLowerCase()
      xs = xs.filter((f) => (f.key + ' ' + f.name + ' ' + f.desc).toLowerCase().includes(q))
    }
    if (activeTags.size) xs = xs.filter((f) => f.tags.some((t) => activeTags.has(t)))
    if (stateFilter === 'on') xs = xs.filter((f) => Object.values(f.state).some((s) => s.on))
    if (stateFilter === 'off') xs = xs.filter((f) => Object.values(f.state).every((s) => !s.on))
    if (stateFilter === 'overrides')
      xs = xs.filter((f) => Object.values(f.state).some((s) => s.overrides > 0))
    if (stateFilter === 'kill-switch') xs = xs.filter((f) => f.tags.includes('kill-switch'))
    xs.sort(cmpBy(sort.col, sort.dir))
    return xs
  }, [flags, filter, activeTags, stateFilter, sort])

  const selectedKeys = Object.keys(selected).filter((k) => selected[k])
  const allSelected = filtered.length > 0 && filtered.every((f) => selected[f.key])
  const someSelected = selectedKeys.length > 0 && !allSelected
  const anyFilters = !!filter.trim() || activeTags.size > 0 || stateFilter

  function setSortCol(col) {
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: col === 'updated' ? 'desc' : 'asc' },
    )
  }

  function toggleFlag(flagKey, envSlug, nextOn) {
    if (envSlug === 'production') {
      setConfirmProd({ flagKeys: [flagKey], action: nextOn ? 'enable' : 'disable' })
      return
    }
    doToggle([flagKey], envSlug, nextOn)
  }
  function doToggle(keys, envSlug, on) {
    setFlags((xs) =>
      xs.map((f) =>
        keys.includes(f.key)
          ? { ...f, state: { ...f.state, [envSlug]: { ...f.state[envSlug], on } } }
          : f,
      ),
    )
    toast.push({
      kind: 'success',
      title: `${on ? 'Enabled' : 'Disabled'} in ${envSlug}`,
      msg: keys.length === 1 ? keys[0] : `${keys.length} flags updated`,
    })
  }

  function clearFilters() {
    setFilter('')
    setActiveTags(new Set())
    setStateFilter(null)
  }

  return (
    <div className="flags-v2">
      <PageHeader
        title="Feature flags"
        sub={
          <>
            Toggle, target, and roll out behavior across{' '}
            <span className="mono" style={{ color: 'var(--text-1)' }}>
              development
            </span>
            ,{' '}
            <span className="mono" style={{ color: 'var(--text-1)' }}>
              staging
            </span>
            , and{' '}
            <span className="mono" style={{ color: 'var(--danger-fg)' }}>
              production
            </span>
            .
          </>
        }
        actions={
          <>
            <Button variant="ghost" leftIcon="refresh">
              Refresh
            </Button>
            <Button variant="primary" leftIcon="plus" onClick={() => setOpenNew(true)}>
              New flag <KbdHint keys={['N']} />
            </Button>
          </>
        }
      />

      {/* Filters bar */}
      <div className="filters-bar">
        <div className="search-input">
          <Icon name="search" size={14} className="ico" />
          <input
            className="filter-input-real"
            placeholder="Search by name, key, description…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className="kbd-hint">
            <Kbd>/</Kbd>
          </span>
        </div>

        <div className="chip-group" role="group" aria-label="Tag filters">
          {topTags.map(([t, n]) => (
            <button
              key={t}
              className="chip"
              aria-pressed={activeTags.has(t)}
              onClick={() =>
                setActiveTags((s) => {
                  const n = new Set(s)
                  n.has(t) ? n.delete(t) : n.add(t)
                  return n
                })
              }
            >
              <span>{t}</span>
              <span className="chip-n num">{n}</span>
            </button>
          ))}
        </div>

        <div className="chip-group" role="group" aria-label="State filter">
          {[
            ['on', 'on anywhere'],
            ['off', 'off everywhere'],
            ['overrides', 'has overrides'],
            ['kill-switch', 'kill switches'],
          ].map(([v, l]) => (
            <button
              key={v}
              className="chip"
              data-tone={v === 'kill-switch' ? 'red' : v === 'overrides' ? 'amber' : undefined}
              aria-pressed={stateFilter === v}
              onClick={() => setStateFilter((cur) => (cur === v ? null : v))}
            >
              {v === 'kill-switch' ? <Icon name="shield" size={11} /> : null}
              {l}
            </button>
          ))}
        </div>

        <span className="spacer" />

        {anyFilters ? (
          <button className="btn ghost sm clear-all" onClick={clearFilters}>
            Clear all <Icon name="x" size={11} />
          </button>
        ) : null}
        <span className="muted num" style={{ fontSize: 12 }}>
          {filtered.length} of {flags.length}
        </span>
      </div>

      {/* List */}
      <div className="flags-list">
        <header className="flags-row flags-head">
          <div className="cell-check">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={(v) => {
                const next = {}
                if (v) filtered.forEach((f) => (next[f.key] = true))
                setSelected(next)
              }}
            />
          </div>
          <SortHead col="name" sort={sort} onSort={setSortCol}>
            Flag
          </SortHead>
          <div className="cell-env">
            <span className="env-label">development</span>
          </div>
          <div className="cell-env">
            <span className="env-label">staging</span>
          </div>
          <div className="cell-env cell-env-prod">
            <span className="env-label">
              production
              <span className="live-dot" aria-label="live traffic" />
            </span>
          </div>
          <SortHead col="updated" sort={sort} onSort={setSortCol} align="right">
            Last edited
          </SortHead>
        </header>

        {filtered.length === 0 ? (
          <EmptyFiltered
            anyFilters={!!anyFilters}
            onClear={clearFilters}
            onNew={() => setOpenNew(true)}
          />
        ) : (
          filtered.map((f) => (
            <FlagRow
              key={f.key}
              flag={f}
              selected={!!selected[f.key]}
              onSelect={(v) => setSelected((s) => ({ ...s, [f.key]: v }))}
              onOpen={() => onOpenFlag(f.key)}
              onToggle={toggleFlag}
            />
          ))
        )}
      </div>

      {selectedKeys.length > 0 ? (
        <BulkBar
          count={selectedKeys.length}
          onEnableDev={() => doToggle(selectedKeys, 'development', true)}
          onEnableStg={() => doToggle(selectedKeys, 'staging', true)}
          onProd={(action) => setConfirmProd({ flagKeys: selectedKeys, action })}
          onAddTag={() => setTagAdd(true)}
          onArchive={() => {
            toast.push({ title: `Archived ${selectedKeys.length} flags` })
            setSelected({})
          }}
          onClear={() => setSelected({})}
        />
      ) : null}

      <ProdConfirmModal
        open={!!confirmProd}
        action={confirmProd?.action}
        flagKeys={confirmProd?.flagKeys || []}
        onClose={() => setConfirmProd(null)}
        onConfirm={() => {
          doToggle(confirmProd.flagKeys, 'production', confirmProd.action === 'enable')
          setConfirmProd(null)
          setSelected({})
        }}
      />

      <BulkTagModal
        open={tagAdd}
        onClose={() => setTagAdd(false)}
        count={selectedKeys.length}
        onApply={() => {
          setTagAdd(false)
          toast.push({ title: `Tagged ${selectedKeys.length} flags` })
        }}
      />

      <NewFlagModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreate={(f) => {
          setFlags((xs) => [
            {
              ...f,
              state: {
                development: { on: false, overrides: 0 },
                staging: { on: false, overrides: 0 },
                production: { on: false, overrides: 0 },
              },
              updated: '2026-05-13 09:00',
              author: 'k_a91c',
            },
            ...xs,
          ])
          setOpenNew(false)
          toast.push({ title: 'Flag created', msg: f.key })
        }}
      />
    </div>
  )
}

// ============ Sortable column header ============
function SortHead({ col, sort, onSort, align, children }) {
  const active = sort.col === col
  return (
    <button
      className={'sort-head ' + (align === 'right' ? 'right' : '')}
      onClick={() => onSort(col)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{children}</span>
      <span className={'sort-arrow ' + (active ? 'on ' + sort.dir : '')}>
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
          <path
            d="M5 1 L8 5 L2 5 Z"
            fill="currentColor"
            opacity={active && sort.dir === 'asc' ? 1 : 0.35}
          />
          <path
            d="M5 11 L2 7 L8 7 Z"
            fill="currentColor"
            opacity={active && sort.dir === 'desc' ? 1 : 0.35}
          />
        </svg>
      </span>
    </button>
  )
}

// ============ Flag row ============
function FlagRow({ flag, selected, onSelect, onOpen, onToggle }) {
  const overridesFor = (env) =>
    (window.OVERRIDES || []).filter((o) => o.flag === flag.key && o.env === env)
  const isKill = flag.tags.includes('kill-switch')
  const author = authorOf(flag.author)

  return (
    <div
      className={'flags-row body' + (selected ? ' selected' : '') + (isKill ? ' kill-switch' : '')}
      data-selected={selected || undefined}
      onClick={onOpen}
    >
      <div className="cell-check" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={onSelect} />
      </div>

      <div className="cell-name">
        {isKill ? (
          <Tip tip="Kill switch — keep off until you need it.">
            <span className="kill-mark">
              <Icon name="shield" size={12} />
            </span>
          </Tip>
        ) : (
          <span className="kill-mark-spacer" />
        )}
        <div className="name-stack">
          <div className="name">{flag.name}</div>
          <div className="key mono">{flag.key}</div>
        </div>
        <TagCluster tags={flag.tags} />
      </div>

      {window.ENVS.map((e) => {
        const s = flag.state[e.slug]
        const overrides = overridesFor(e.slug)
        return (
          <div
            key={e.slug}
            className={'cell-env' + (e.slug === 'production' ? ' cell-env-prod' : '')}
            onClick={(ev) => ev.stopPropagation()}
          >
            <StatePill
              flag={flag}
              env={e.slug}
              state={s}
              overrides={overrides}
              onToggle={(v) => onToggle(flag.key, e.slug, v)}
            />
          </div>
        )
      })}

      <div className="cell-edited">
        <Tip tip={`${author.name} · ${flag.author} · ${flag.updated}`}>
          <span className={'avatar sm color-' + author.color}>{author.initials}</span>
        </Tip>
        <div className="edited-stack">
          <div className="name">{author.name}</div>
          <div className="when">{relDate(flag.updated)}</div>
        </div>
      </div>
    </div>
  )
}

// ============ Tag cluster — right-aligned, hover-revealed ============
function TagCluster({ tags }) {
  if (!tags || tags.length === 0) return <span className="tag-cluster" />
  return (
    <span className="tag-cluster" aria-label={'tags: ' + tags.join(', ')}>
      <span className="tag-dots">
        {tags.slice(0, 3).map((t) => (
          <span key={t} className={'tag-dot tag-' + t.replace(/[^a-z]/g, '')} />
        ))}
      </span>
      <span className="tag-popover">
        {tags.map((t) => (
          <span key={t} className="tag-chip">
            {t}
          </span>
        ))}
      </span>
    </span>
  )
}

// ============ State pill ============
function StatePill({ flag, env, state, overrides, onToggle }) {
  const hasOverrides = state.overrides > 0
  return (
    <div
      className={'state-pill' + (state.on ? ' on' : '') + (hasOverrides ? ' has-overrides' : '')}
      data-env={env}
    >
      <Toggle
        checked={state.on}
        size="sm"
        production={env === 'production'}
        onChange={onToggle}
        ariaLabel={`${flag.key} in ${env}`}
      />
      <span className="state-label">{state.on ? 'on' : 'off'}</span>
      {hasOverrides ? (
        <span className="overrides-count" aria-label={`${state.overrides} overrides`}>
          <Icon name="target" size={11} />
          <span className="num">{state.overrides}</span>
        </span>
      ) : null}
      {hasOverrides ? (
        <div className="overrides-pop" role="tooltip">
          <div className="pop-head">
            <Icon name="target" size={11} />
            <span>
              {state.overrides} override{state.overrides > 1 ? 's' : ''} in{' '}
              <span className="mono">{env}</span>
            </span>
          </div>
          <div className="pop-body">
            {overrides.slice(0, 4).map((o, i) => (
              <div key={o.id} className="pop-row">
                <span className="ord mono">{String(i + 1).padStart(2, '0')}</span>
                <div className="rule">
                  <span className="mono">{o.key}</span>
                  <span className="muted"> {o.op} </span>
                  <span className="mono val">
                    {o.val.length > 26 ? o.val.slice(0, 24) + '…' : o.val}
                  </span>
                </div>
                <span className={'res ' + (o.result ? 'on' : 'off')}>
                  → {o.result ? 'true' : 'false'}
                </span>
              </div>
            ))}
            {overrides.length > 4 ? (
              <div className="pop-more">+{overrides.length - 4} more</div>
            ) : null}
          </div>
          <div className="pop-foot">
            <span className="muted">First match wins</span>
            <span className="spacer" />
            <span className="mono pop-cta">Open rules →</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ============ Bulk action bar ============
function BulkBar({ count, onEnableDev, onEnableStg, onProd, onAddTag, onArchive, onClear }) {
  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <div className="bulk-count">
        <span className="num">{count}</span>
        <span>selected</span>
      </div>
      <div className="bulk-sep" />
      <span className="bulk-section-label">Toggle in</span>
      <Button size="sm" leftIcon="check" onClick={onEnableDev}>
        development
      </Button>
      <Button size="sm" leftIcon="check" onClick={onEnableStg}>
        staging
      </Button>
      <Button size="sm" variant="danger" leftIcon="alert" onClick={() => onProd('enable')}>
        production…
      </Button>
      <div className="bulk-sep" />
      <Button size="sm" variant="ghost" leftIcon="plus" onClick={onAddTag}>
        Add tag
      </Button>
      <Button size="sm" variant="ghost" leftIcon="history" onClick={onArchive}>
        Archive
      </Button>
      <button className="bulk-close" onClick={onClear} aria-label="Clear selection">
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

// ============ Empty filtered state ============
function EmptyFiltered({ anyFilters, onClear, onNew }) {
  return (
    <div className="empty-filtered">
      <div className="ill">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
          <rect
            x="10"
            y="14"
            width="36"
            height="6"
            rx="2"
            fill="var(--bg-subtle)"
            stroke="var(--border-strong)"
          />
          <rect
            x="10"
            y="26"
            width="36"
            height="6"
            rx="2"
            fill="var(--bg-subtle)"
            stroke="var(--border-strong)"
          />
          <rect
            x="10"
            y="38"
            width="36"
            height="6"
            rx="2"
            fill="var(--bg-subtle)"
            stroke="var(--border-strong)"
          />
          <circle
            cx="42"
            cy="42"
            r="11"
            fill="var(--bg-elev)"
            stroke="var(--pri-soft-border)"
            strokeWidth="1.5"
          />
          <path d="M38 38l8 8" stroke="var(--pri)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="40" cy="40" r="4" fill="none" stroke="var(--pri)" strokeWidth="2" />
        </svg>
      </div>
      <h3>{anyFilters ? 'No flags match these filters' : 'No flags yet'}</h3>
      <p>
        {anyFilters
          ? 'Try clearing a chip or relaxing the search. Your filter combination is too narrow.'
          : 'Create your first flag to start shipping behind a switch.'}
      </p>
      <div className="row" style={{ gap: 8 }}>
        {anyFilters ? (
          <Button variant="ghost" onClick={onClear} leftIcon="x">
            Clear filters
          </Button>
        ) : null}
        <Button variant="primary" leftIcon="plus" onClick={onNew}>
          New flag
        </Button>
      </div>
    </div>
  )
}

// ============ Bulk tag modal ============
function BulkTagModal({ open, onClose, count, onApply }) {
  const [picked, setPicked] = useState(new Set())
  useEffect(() => {
    if (open) setPicked(new Set())
  }, [open])
  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-header">
        <h2>
          Add tags to {count} flag{count === 1 ? '' : 's'}
        </h2>
        <div className="sub">Selected tags are added; existing tags are preserved.</div>
      </div>
      <div className="modal-body">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {window.TAGS.map((t) => (
            <button
              key={t}
              className="chip"
              aria-pressed={picked.has(t)}
              onClick={() =>
                setPicked((s) => {
                  const n = new Set(s)
                  n.has(t) ? n.delete(t) : n.add(t)
                  return n
                })
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <span className="spacer" />
        <Button variant="primary" disabled={picked.size === 0} onClick={onApply}>
          Apply {picked.size || ''} tag{picked.size === 1 ? '' : 's'}
        </Button>
      </div>
    </Modal>
  )
}

Object.assign(window, { FlagsScreenV2 })
