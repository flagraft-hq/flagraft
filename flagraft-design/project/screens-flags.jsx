/* global React, Icon, Button, Toggle, Badge, Checkbox, Modal, useToast, TagRow, PageHeader, Tip, Kbd, KbdHint, ContextOverridesSection */
const { useState, useMemo, useEffect, useRef } = React

// ============================================================
// SCREEN: Flags list (workhorse)
// ============================================================
function FlagsScreen({ activeEnv, onOpenFlag, openNew, setOpenNew, showAnnotationsInitial }) {
  const [flags, setFlags] = useState(window.FLAGS)
  const [filter, setFilter] = useState('')
  const [tagFilter, setTagFilter] = useState(null)
  const [selected, setSelected] = useState({})
  const [confirmProd, setConfirmProd] = useState(null) // { flagKeys, action }
  const [showAnnos, setShowAnnos] = useState(true)
  useEffect(() => {
    if (typeof showAnnotationsInitial === 'boolean') setShowAnnos(showAnnotationsInitial)
  }, [showAnnotationsInitial])
  const toast = useToast()

  const filtered = useMemo(() => {
    let xs = flags
    if (filter.trim()) {
      const q = filter.toLowerCase()
      xs = xs.filter((f) => (f.key + ' ' + f.name + ' ' + f.desc).toLowerCase().includes(q))
    }
    if (tagFilter) xs = xs.filter((f) => f.tags.includes(tagFilter))
    return xs
  }, [flags, filter, tagFilter])

  const selectedKeys = Object.keys(selected).filter((k) => selected[k])
  const allSelected = filtered.length > 0 && filtered.every((f) => selected[f.key])
  const someSelected = selectedKeys.length > 0 && !allSelected

  function toggleFlag(flagKey, envSlug, nextOn) {
    if (
      envSlug === 'production' &&
      nextOn !== flags.find((f) => f.key === flagKey)?.state.production.on
    ) {
      // ask confirmation
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

  // Filtered top tags (top 6 by frequency)
  const topTags = useMemo(() => {
    const counts = {}
    flags.forEach((f) => f.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)))
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [flags])

  return (
    <div>
      <PageHeader
        title="Feature flags"
        sub={`${flags.length} flags · scoped view: `}
        actions={
          <>
            <Button variant="ghost" leftIcon="refresh">
              Refresh
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowAnnos((v) => !v)}
              leftIcon={showAnnos ? 'eyeOff' : 'eye'}
            >
              {showAnnos ? 'Hide notes' : 'Show notes'}
            </Button>
            <Button variant="primary" leftIcon="plus" onClick={() => setOpenNew(true)}>
              New flag <KbdHint keys={['N']} />
            </Button>
          </>
        }
      />

      <div className="card anno">
        {showAnnos ? <Anno n="1" top={-10} left={-10} /> : null}

        <div className="flags-toolbar">
          <div className="filter-input anno">
            {showAnnos ? <Anno n="2" top={-10} right={-10} /> : null}
            <input
              placeholder="Filter by key, name, description… (press / )"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <div className="row" style={{ gap: 4 }}>
            {topTags.map(([t, n]) => (
              <button
                key={t}
                className="badge"
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                style={{
                  cursor: 'pointer',
                  background: tagFilter === t ? 'var(--pri-soft)' : 'var(--bg-subtle)',
                  borderColor: tagFilter === t ? 'var(--pri-soft-border)' : 'var(--border)',
                  color: tagFilter === t ? 'var(--pri-fg)' : 'var(--text-2)',
                }}
              >
                {t} <span className="muted num">{n}</span>
              </button>
            ))}
            {tagFilter ? (
              <button className="btn ghost sm" onClick={() => setTagFilter(null)}>
                Clear
              </button>
            ) : null}
          </div>

          <span className="spacer" />

          {selectedKeys.length > 0 ? (
            <div
              className="row anno"
              style={{
                background: 'var(--pri-soft)',
                border: '1px solid var(--pri-soft-border)',
                padding: '4px 6px 4px 10px',
                borderRadius: 8,
              }}
            >
              {showAnnos ? <Anno n="4" top={-12} right={-10} /> : null}
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pri-fg)' }}>
                {selectedKeys.length} selected
              </span>
              <Button size="sm" onClick={() => doToggle(selectedKeys, 'development', true)}>
                Enable in dev
              </Button>
              <Button size="sm" onClick={() => doToggle(selectedKeys, 'staging', true)}>
                Enable in stg
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirmProd({ flagKeys: selectedKeys, action: 'enable' })}
              >
                Enable in prod…
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
                <Icon name="x" size={12} />
              </Button>
            </div>
          ) : (
            <>
              <span className="legend">
                <span className="it">
                  <span className="dot teal" />
                  on
                </span>
                <span className="it">
                  <span className="dot gray" />
                  off
                </span>
                <span className="it">
                  <span className="dot amber" />
                  overrides
                </span>
              </span>
            </>
          )}
        </div>

        <table className="flag-table">
          <thead>
            <tr>
              <th className="row-checkbox">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(v) => {
                    const next = {}
                    if (v) filtered.forEach((f) => (next[f.key] = true))
                    setSelected(next)
                  }}
                />
              </th>
              <th>Flag</th>
              {window.ENVS.map((e) => (
                <th key={e.slug} className="env-col-header">
                  <div className="label">
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: e.slug === 'production' ? 'var(--danger-fg)' : 'var(--text-3)',
                      }}
                    >
                      {e.slug}
                    </span>
                  </div>
                </th>
              ))}
              <th>Last edited</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.key} data-selected={!!selected[f.key]} onClick={() => onOpenFlag(f.key)}>
                <td className="row-checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={!!selected[f.key]}
                    onChange={(v) => setSelected((s) => ({ ...s, [f.key]: v }))}
                  />
                </td>
                <td>
                  <div className="name-cell">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{f.name}</span>
                    </div>
                    <span className="key mono">{f.key}</span>
                    <TagRow tags={f.tags} />
                  </div>
                </td>
                {window.ENVS.map((e) => {
                  const s = f.state[e.slug]
                  return (
                    <td key={e.slug} className="env-col" onClick={(ev) => ev.stopPropagation()}>
                      <div className="tg-cell">
                        <Toggle
                          checked={s.on}
                          production={e.slug === 'production'}
                          onChange={(v) => toggleFlag(f.key, e.slug, v)}
                          ariaLabel={`${f.key} in ${e.slug}`}
                        />
                        <span className={'state ' + (s.on ? 'on' : '')}>{s.on ? 'ON' : 'off'}</span>
                        {s.overrides > 0 ? (
                          <Tip tip={`${s.overrides} override${s.overrides > 1 ? 's' : ''}`}>
                            <span className="ovr">+{s.overrides}</span>
                          </Tip>
                        ) : null}
                      </div>
                    </td>
                  )
                })}
                <td>
                  <div style={{ fontSize: 12 }}>{f.updated.split(' ')[0]}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                    {f.author}
                  </div>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" aria-label="Row actions">
                    <Icon name="chevronRight" size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty">
                    <div className="ill">
                      <Icon name="search" size={28} />
                    </div>
                    <h3>No flags match</h3>
                    <p>Try clearing your filter, or create the flag you were looking for.</p>
                    <Button variant="primary" leftIcon="plus" onClick={() => setOpenNew(true)}>
                      New flag
                    </Button>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Annotations overlay list */}
      {showAnnos ? (
        <div className="anno-list">
          <header>
            <Icon name="info" size={14} />
            Design notes — Flags list
          </header>
          <ol>
            <li>
              <span className="pill">1</span>
              <div>
                <b>Density tuned for ops.</b> 8 visible rows on a 13" laptop, all three envs in one
                glance — the most common job on this page is "see prod status fast."
              </div>
            </li>
            <li>
              <span className="pill">2</span>
              <div>
                <b>Filter is keyboard-first.</b> <Kbd>/</Kbd> focuses it from anywhere; tag chips
                below filter by tag without leaving the keyboard.
              </div>
            </li>
            <li>
              <span className="pill">3</span>
              <div>
                <b>Prod toggles wear a red ring</b> when on, reminding you what you're touching.
                Prod always requires the confirmation modal.
              </div>
            </li>
            <li>
              <span className="pill">4</span>
              <div>
                <b>Bulk bar appears in-place</b>, not a separate floating drawer — keeps actions
                where the eye already is.
              </div>
            </li>
          </ol>
        </div>
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
              updated: 'now',
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

// ============ Prod confirm ============
function ProdConfirmModal({ open, action, flagKeys, onClose, onConfirm }) {
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (open) setTyped('')
  }, [open])
  const word = 'production'
  const ok = typed === word
  return (
    <Modal open={open} onClose={onClose} className="prod-confirm">
      <div className="modal-header">
        <h2>{action === 'enable' ? 'Enable in production?' : 'Disable in production?'}</h2>
        <div className="sub">This affects live traffic immediately.</div>
      </div>
      <div className="modal-body">
        <div className="warning-strip">
          <Icon name="alert" size={16} />
          <div>
            {action === 'enable' ? 'Enabling' : 'Disabling'} <b>{flagKeys.length}</b>{' '}
            {flagKeys.length === 1 ? 'flag' : 'flags'} in production. Existing overrides will still
            apply.
          </div>
        </div>
        <div
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
            Flags affected
          </div>
          <div className="col" style={{ gap: 6 }}>
            {flagKeys.map((k) => (
              <span key={k} className="mono" style={{ fontSize: 12 }}>
                {k}
              </span>
            ))}
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>
            Type{' '}
            <span className="mono" style={{ color: 'var(--danger-fg)' }}>
              production
            </span>{' '}
            to confirm
          </label>
          <input
            className="input mono"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
          />
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>
          Cancel <KbdHint keys={['esc']} />
        </Button>
        <span className="spacer" />
        <Button variant="danger" className="solid" disabled={!ok} onClick={onConfirm}>
          Yes, {action} in production
        </Button>
      </div>
    </Modal>
  )
}

// ============ New flag modal ============
function NewFlagModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [desc, setDesc] = useState('')
  const [autoKey, setAutoKey] = useState(true)
  const [tags, setTags] = useState([])
  useEffect(() => {
    if (open) {
      setName('')
      setKey('')
      setDesc('')
      setTags([])
      setAutoKey(true)
    }
  }, [open])
  useEffect(() => {
    if (autoKey) {
      const k = name
        .toLowerCase()
        .replace(/[^a-z0-9 .]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
      setKey(k)
    }
  }, [name, autoKey])

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="modal-header">
        <h2>Create flag</h2>
        <div className="sub">
          Flags start <b>off</b> in every environment. You can change defaults below.
        </div>
      </div>
      <div className="modal-body">
        <div className="field">
          <label>Name</label>
          <input
            className="input"
            placeholder="e.g. New cart experience"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <span className="hint">Human-readable. Shown in the admin UI.</span>
        </div>

        <div className="field">
          <label>
            Key
            <span className="muted" style={{ fontSize: 11.5 }}>
              · immutable
            </span>
          </label>
          <input
            className="input mono"
            value={key}
            onChange={(e) => {
              setAutoKey(false)
              setKey(e.target.value)
            }}
            placeholder="checkout.new-cart"
          />
          <span className="hint">
            Used in your code: <span className="mono">client.isEnabled('{key || 'flag-key'}')</span>
          </span>
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            className="textarea"
            placeholder="What does this flag control? Who owns it? When can it be removed?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Tags</label>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {window.TAGS.map((t) => (
              <button
                key={t}
                className="badge"
                style={{
                  cursor: 'pointer',
                  background: tags.includes(t) ? 'var(--pri-soft)' : 'var(--bg-subtle)',
                  borderColor: tags.includes(t) ? 'var(--pri-soft-border)' : 'var(--border)',
                  color: tags.includes(t) ? 'var(--pri-fg)' : 'var(--text-2)',
                }}
                onClick={() =>
                  setTags((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]))
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
            Snippet preview
          </div>
          <pre className="code">{`import { flagraft } from '@flagraft/sdk';

const on = await flagraft.isEnabled('${key || 'your-flag-key'}', {
  userId: ctx.userId,
});`}</pre>
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>
          <Kbd>⌘</Kbd> <Kbd>↵</Kbd> to create
        </span>
        <Button
          variant="primary"
          disabled={!name || !key}
          onClick={() => onCreate({ name, key, desc, tags })}
        >
          Create flag
        </Button>
      </div>
    </Modal>
  )
}

// ============ Flag detail ============
function FlagDetail({ flagKey, onBack }) {
  const flag = window.FLAGS.find((f) => f.key === flagKey) || window.FLAGS[0]
  const [tab, setTab] = useState('environments')
  const [state, setState] = useState(flag.state)
  const toast = useToast()

  const overrides = window.OVERRIDES.filter((o) => o.flag === flag.key)

  return (
    <div>
      <PageHeader
        breadcrumb={['Checkout Web', 'Flags', flag.name]}
        title={flag.name}
        actions={
          <>
            <Button variant="ghost" leftIcon="copy">
              Copy key
            </Button>
            <Button variant="ghost" leftIcon="code">
              SDK snippet
            </Button>
            <Button variant="ghost" leftIcon="edit">
              Edit
            </Button>
            <Button variant="danger" leftIcon="trash">
              Delete
            </Button>
          </>
        }
      />

      <div className="detail-header">
        <div className="row">
          <div style={{ flex: 1 }}>
            <span className="flag-key">
              <Icon name="flag" size={12} />
              {flag.key}
              <button className="icon-btn" style={{ width: 20, height: 20 }} aria-label="Copy">
                <Icon name="copy" size={11} />
              </button>
            </span>
            <div className="desc">{flag.desc}</div>
            <div className="meta-row">
              <span className="item">
                <Icon name="user" size={12} />
                Owner{' '}
                <b className="mono" style={{ color: 'var(--text-2)' }}>
                  {flag.author}
                </b>
              </span>
              <span className="item">
                <Icon name="history" size={12} />
                Created <b style={{ color: 'var(--text-2)' }}>{flag.created}</b>
              </span>
              <span className="item">
                <Icon name="bolt" size={12} />
                Last evaluated <b style={{ color: 'var(--text-2)' }}>just now</b>
              </span>
              <span className="item">
                <Icon name="target" size={12} />
                {overrides.length} overrides
              </span>
            </div>
          </div>
          <div className="col" style={{ alignItems: 'flex-end', gap: 6 }}>
            <TagRow tags={flag.tags} />
            <span className="muted mono" style={{ fontSize: 11 }}>
              updated {flag.updated}
            </span>
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {['environments', 'usage', 'history'].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className="tab"
            onClick={() => setTab(t)}
          >
            {t === 'environments'
              ? 'Environments & overrides'
              : t === 'usage'
                ? 'Usage'
                : 'History'}
            {t === 'environments' ? (
              <span className="count num">
                {(window.OVERRIDES || []).filter((o) => o.flag === flag.key).length}
              </span>
            ) : null}
            {t === 'history' ? <span className="count num">12</span> : null}
          </button>
        ))}
      </div>

      {tab === 'environments' ? (
        <>
          <div className="grid-3" style={{ marginTop: 18 }}>
            {window.ENVS.map((e) => {
              const s = state[e.slug]
              return (
                <div key={e.slug} className="card" style={{ padding: 18 }}>
                  <div className="row" style={{ marginBottom: 10 }}>
                    <span className={'badge ' + e.color} dot>
                      <span className="dot" />
                      {e.name}
                    </span>
                    <span className="spacer" />
                    <Toggle
                      checked={s.on}
                      production={e.slug === 'production'}
                      size="lg"
                      onChange={(v) => {
                        setState((st) => ({ ...st, [e.slug]: { ...st[e.slug], on: v } }))
                        toast.push({
                          title: `${v ? 'Enabled' : 'Disabled'} in ${e.slug}`,
                          msg: flag.key,
                        })
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 13 }}>
                    <span
                      style={{ fontWeight: 600, color: s.on ? 'var(--pri-fg)' : 'var(--text-3)' }}
                    >
                      {s.on ? 'Enabled' : 'Disabled'}
                    </span>
                    <span className="muted"> · default value</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {s.overrides > 0 ? (
                      <>
                        +{s.overrides} override{s.overrides > 1 ? 's' : ''} can change this result.
                      </>
                    ) : (
                      'No overrides — every caller gets the default.'
                    )}
                  </div>
                  <div
                    className="row"
                    style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon="plus"
                      onClick={() => {
                        const el = document.getElementById('ctx-overrides')
                        if (el)
                          el.scrollTo
                            ? el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            : null
                      }}
                    >
                      Manage overrides
                    </Button>
                    <span className="spacer" />
                    <span className="muted mono" style={{ fontSize: 11 }}>
                      ~14ms p50
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div id="ctx-overrides" style={{ marginTop: 24 }}>
            <ContextOverridesSection flag={flag} defaults={state} />
          </div>
        </>
      ) : null}

      {tab === 'usage' ? <UsageTab flag={flag} /> : null}
      {tab === 'history' ? <HistoryTab flag={flag} /> : null}
    </div>
  )
}

function OverridesTab({ flag, overrides }) {
  const [showBuilder, setShowBuilder] = useState(false)
  const [env, setEnv] = useState('production')
  const list = overrides.filter((o) => o.env === env)
  return (
    <div style={{ marginTop: 18 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="env-chips">
          {window.ENVS.map((e) => (
            <button
              key={e.slug}
              className="env-chip"
              data-env={e.slug}
              aria-pressed={env === e.slug}
              onClick={() => setEnv(e.slug)}
            >
              <span className="dot" />
              {e.slug}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <Button variant="primary" leftIcon="plus" onClick={() => setShowBuilder(true)}>
          Add override
        </Button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>
            Override rules in{' '}
            <span className="mono" style={{ fontWeight: 500 }}>
              {env}
            </span>
          </h3>
          <span className="muted" style={{ fontSize: 12 }}>
            Rules are evaluated top-to-bottom. First match wins.
          </span>
          <span className="spacer" />
          <Badge tone="slate">{list.length} rules</Badge>
        </div>
        {list.length === 0 ? (
          <div className="empty">
            <div className="ill">
              <Icon name="target" size={28} />
            </div>
            <h3>No overrides in {env}</h3>
            <p>
              Without overrides, every caller gets the environment default (
              {flag.state[env].on ? 'on' : 'off'}).
            </p>
            <Button variant="primary" leftIcon="plus" onClick={() => setShowBuilder(true)}>
              Add override
            </Button>
          </div>
        ) : (
          <div>
            {list.map((o, i) => (
              <div
                key={o.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr auto',
                  gap: 12,
                  padding: '12px 18px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-4)', fontSize: 12 }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                    <span className="mono" style={{ fontSize: 13 }}>
                      if
                    </span>
                    <Badge tone="slate" mono>
                      {o.key}
                    </Badge>
                    <span className="muted">{o.op}</span>
                    <Badge tone="slate" mono>
                      {o.val}
                    </Badge>
                    <span className="mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      then return
                    </span>
                    <Badge tone={o.result ? 'teal' : 'red'} dot>
                      {o.result ? 'true' : 'false'}
                    </Badge>
                  </div>
                  {o.note ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {o.note}
                    </div>
                  ) : null}
                </div>
                <div className="row">
                  <Tip tip="Edit rule">
                    <button className="icon-btn">
                      <Icon name="edit" size={14} />
                    </button>
                  </Tip>
                  <Tip tip="Delete">
                    <button className="icon-btn">
                      <Icon name="trash" size={14} />
                    </button>
                  </Tip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <OverrideBuilder
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        env={env}
        flag={flag}
      />
    </div>
  )
}

function OverrideBuilder({ open, onClose, env, flag }) {
  const [key, setKey] = useState('userId')
  const [op, setOp] = useState('equals')
  const [val, setVal] = useState('')
  const [result, setResult] = useState(true)
  const [note, setNote] = useState('')

  const fields = window.CONTEXT_FIELDS || []
  const field = fields.find((f) => f.key === key) || fields[0]

  const opsByType = {
    string: [
      ['equals', 'equals'],
      ['in', 'in'],
      ['startsWith', 'starts with'],
      ['contains', 'contains'],
      ['regex', 'regex'],
    ],
    enum: [
      ['equals', 'equals'],
      ['in', 'in'],
    ],
    boolean: [['is', 'is']],
    number: [
      ['eq', '='],
      ['neq', '≠'],
      ['lt', '<'],
      ['lte', '≤'],
      ['gt', '>'],
      ['gte', '≥'],
      ['between', 'between'],
    ],
    version: [
      ['eq', '='],
      ['gte', '≥'],
      ['lte', '≤'],
      ['satisfies', 'satisfies range'],
    ],
    date: [
      ['before', 'before'],
      ['after', 'after'],
      ['between', 'between'],
    ],
  }
  const ops = opsByType[field?.type] || opsByType.string
  // If op isn't valid for the field's type, fall back to the first.
  const opValid = ops.find((o) => o[0] === op) ? op : ops[0][0]

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="modal-header">
        <h2>Add override</h2>
        <div className="sub">
          For <span className="mono">{flag.key}</span> in <span className="mono">{env}</span>
        </div>
      </div>
      <div className="modal-body">
        <div
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, fontSize: 13 }}>
            <span className="mono" style={{ color: 'var(--text-3)' }}>
              if
            </span>
            <select
              className="select mono"
              style={{ width: 160, height: 30 }}
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setVal('')
              }}
            >
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.key}
                </option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 130, height: 30 }}
              value={opValid}
              onChange={(e) => setOp(e.target.value)}
            >
              {ops.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {field?.type === 'enum' ? (
              <select
                className="select mono"
                style={{ minWidth: 200, flex: 1, height: 30 }}
                value={val}
                onChange={(e) => setVal(e.target.value)}
              >
                <option value="">Select a value…</option>
                {(field.enumValues || []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : field?.type === 'boolean' ? (
              <select
                className="select mono"
                style={{ minWidth: 200, flex: 1, height: 30 }}
                value={val}
                onChange={(e) => setVal(e.target.value)}
              >
                <option value="">Select…</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                className="input mono"
                style={{ minWidth: 200, flex: 1, height: 30 }}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={
                  opValid === 'in'
                    ? 'usr_a, usr_b, usr_c'
                    : field?.type === 'version'
                      ? '4.18.2 or >=4.0.0'
                      : field?.type === 'number'
                        ? '42'
                        : field?.example || 'value'
                }
              />
            )}
            <span className="mono" style={{ color: 'var(--text-3)' }}>
              then return
            </span>
            <div className="row" style={{ gap: 4 }}>
              <button
                className={'btn sm ' + (result ? 'primary' : '')}
                onClick={() => setResult(true)}
              >
                true
              </button>
              <button
                className={'btn sm ' + (!result ? 'danger solid' : '')}
                onClick={() => setResult(false)}
              >
                false
              </button>
            </div>
          </div>
          {field ? (
            <div
              className="row"
              style={{ marginTop: 10, gap: 8, fontSize: 11.5, color: 'var(--text-3)' }}
            >
              <span className="ctx-pill">
                <span className="mono">{field.key}</span>
                <span style={{ opacity: 0.7 }}>·</span>
                <span className="mono">{field.type}</span>
                <span style={{ opacity: 0.7 }}>·</span>
                <span>{field.source}</span>
              </span>
              <span style={{ flex: 1 }}>{field.desc}</span>
            </div>
          ) : null}
        </div>

        <div className="muted" style={{ fontSize: 11.5, marginBottom: 14 }}>
          Don't see the field you need?{' '}
          <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--pri-fg)' }}>
            Add it in Project settings → Context fields
          </a>
          .
        </div>

        <div className="field">
          <label>
            Note{' '}
            <span className="muted" style={{ fontSize: 11 }}>
              · optional
            </span>
          </label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this rule? Helps the next on-call."
          />
        </div>

        <div
          style={{
            background: 'var(--bg-muted)',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            padding: 14,
          }}
        >
          <div className="row" style={{ marginBottom: 8 }}>
            <Icon name="play" size={14} className="muted" />
            <span style={{ fontWeight: 600, fontSize: 12.5 }}>Preview a request</span>
          </div>
          <pre className="code" style={{ background: 'var(--bg-elev)' }}>
            {`GET /api/v1/client/features/${flag.key}?${key}=${val || '<value>'}
Authorization: ff_cl_***

→ { "enabled": ${result}, "reason": "override" }`}
          </pre>
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <span className="spacer" />
        <Button variant="primary" disabled={!val.trim()}>
          Save rule
        </Button>
      </div>
    </Modal>
  )
}

function UsageTab({ flag }) {
  // small sparkline-ish chart using SVG
  const days = 14
  const series = useMemo(
    () =>
      Array.from({ length: days }, (_, i) =>
        Math.round(8000 + Math.sin(i / 2) * 1500 + Math.random() * 1500),
      ),
    [flag.key],
  )
  const max = Math.max(...series)
  const w = 720,
    h = 140,
    pad = 8
  const xStep = (w - pad * 2) / (series.length - 1)
  const path = series
    .map(
      (v, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * xStep} ${h - pad - (v / max) * (h - pad * 2)}`,
    )
    .join(' ')
  const area = path + ` L ${pad + (series.length - 1) * xStep} ${h - pad} L ${pad} ${h - pad} Z`

  return (
    <div style={{ marginTop: 18 }}>
      <div className="grid-3">
        {[
          { label: 'Evaluations · 7d', val: '142,801', sub: '+12.4% vs prior 7d', tone: 'teal' },
          { label: 'Avg latency · prod', val: '14ms', sub: 'p99 22ms', tone: 'slate' },
          {
            label: 'True rate',
            val: '64.2%',
            sub: 'overrides on top of off-default',
            tone: 'amber',
          },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: 18 }}>
            <div
              className="muted"
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              {s.label}
            </div>
            <div
              className="num"
              style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4 }}
            >
              {s.val}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, padding: 18 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Evaluations · last 14 days</h3>
          <span className="spacer" />
          <span className="legend">
            <span className="it">
              <span className="dot teal" />
              true
            </span>
            <span className="it">
              <span className="dot gray" />
              false
            </span>
          </span>
        </div>
        <svg
          width="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--teal-400)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--teal-400)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#g1)" />
          <path d={path} fill="none" stroke="var(--teal-500)" strokeWidth="2" />
          {series.map((v, i) => (
            <circle
              key={i}
              cx={pad + i * xStep}
              cy={h - pad - (v / max) * (h - pad * 2)}
              r="2.5"
              fill="var(--bg-elev)"
              stroke="var(--teal-500)"
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 18 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>SDK snippet</h3>
        <pre className="code">{`// Server-side, Node 20+
import { Flagraft } from '@flagraft/sdk';
const ff = new Flagraft({ apiKey: process.env.FLAGRAFT_CLIENT_KEY });

if (await ff.isEnabled('${flag.key}', { userId, plan })) {
  // new path
} else {
  // legacy path
}`}</pre>
      </div>
    </div>
  )
}

function HistoryTab({ flag }) {
  const events = [
    {
      when: '2026-05-12 08:32',
      actor: 'k_a91c',
      what: 'Added override',
      detail: 'cohort=beta → true (production)',
    },
    {
      when: '2026-05-12 06:14',
      actor: 'k_a91c',
      what: 'Disabled in production',
      detail: 'paused EU rollout',
    },
    { when: '2026-05-09 17:02', actor: 'k_a91c', what: 'Enabled in production', detail: '' },
    { when: '2026-05-04 11:22', actor: 'k_2f10', what: 'Updated description', detail: '' },
    { when: '2026-04-02 09:00', actor: 'k_a91c', what: 'Created flag', detail: '' },
  ]
  return (
    <div style={{ marginTop: 18 }}>
      <div className="card" style={{ padding: 14 }}>
        {events.map((e, i) => (
          <div className="audit-row" key={i}>
            <div className="when">
              {e.when.split(' ')[1]}
              <br />
              <span className="muted">{e.when.split(' ')[0]}</span>
            </div>
            <div className="what">
              <div className="lead">
                {e.what}
                {e.detail ? <span className="muted"> · {e.detail}</span> : null}
              </div>
              <div className="actor mono">by {e.actor}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

Object.assign(window, { FlagsScreen, FlagDetail, ProdConfirmModal, NewFlagModal })
