/* global React, Icon, Button, Toggle, Badge, KbdHint, Kbd */
const { useState, useEffect, useRef, useMemo } = React;

// ============ Topbar ============
function TopBar({ project, onSwitchProject, activeEnv, setActiveEnv, onOpenSearch, onToggleTheme, theme, onShowHelp }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">FR</span>
        <span>Flagraft</span>
      </div>

      <button className="project-switcher" onClick={onSwitchProject} aria-label="Switch project">
        <Icon name="layers" size={14} className="muted"/>
        <span className="proj-name">{project.name}</span>
        <span className="proj-slug mono">/{project.slug}</span>
        <Icon name="chevronDown" size={14} className="muted"/>
      </button>

      <div className="env-chips" role="tablist" aria-label="Environment scope">
        {window.ENVS.map((e) => (
          <button
            key={e.slug}
            role="tab"
            aria-pressed={activeEnv === e.slug}
            data-env={e.slug}
            className="env-chip"
            onClick={() => setActiveEnv(e.slug)}
            title={e.name}
          >
            <span className="dot"/>{e.slug}
          </button>
        ))}
      </div>

      <div className="topbar-search">
        <Icon name="search" size={14} className="search-icon"/>
        <input
          placeholder="Search flags, overrides, keys…"
          onFocus={(e) => { e.target.blur(); onOpenSearch(); }}
          readOnly
        />
        <span className="kbd-hint"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
      </div>

      <div className="topbar-right">
        <span className="key-indicator" title="Acting key">
          <span className="dot"/>
          <span>ff_ad_a91c</span>
          <span className="muted">· admin</span>
        </span>
        <Tip tip="Keyboard shortcuts (?)">
          <button className="icon-btn" onClick={onShowHelp} aria-label="Keyboard shortcuts">
            <Icon name="keyboard" size={16}/>
          </button>
        </Tip>
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16}/>
        </button>
      </div>
    </header>
  );
}

// ============ Side nav ============
const NAV = [
  { group: 'WORKSPACE', items: [
    { id: 'flags', label: 'Flags', icon: 'flag', shortcut: ['g','f'], count: 24 },
    { id: 'overrides', label: 'Overrides', icon: 'target', shortcut: ['g','o'], count: 17 },
    { id: 'audit', label: 'Audit log', icon: 'history', shortcut: ['g','a'] },
  ]},
  { group: 'CONFIGURE', items: [
    { id: 'environments', label: 'Environments', icon: 'layers', shortcut: ['g','e'] },
    { id: 'keys', label: 'API keys', icon: 'key', shortcut: ['g','k'] },
    { id: 'settings', label: 'Project settings', icon: 'settings' },
  ]},
  { group: 'EXPLORE', items: [
    { id: 'onboarding', label: 'Onboarding', icon: 'sparkles' },
    { id: 'error', label: 'Degraded states', icon: 'wifiOff' },
    { id: 'system', label: 'Design system', icon: 'palette' },
  ]},
];

function SideNav({ current, onNav }) {
  return (
    <nav className="sidenav">
      {NAV.map((g) => (
        <React.Fragment key={g.group}>
          <div className="nav-section">{g.group}</div>
          {g.items.map((it) => (
            <button
              key={it.id}
              className="nav-item"
              aria-current={current === it.id ? 'page' : undefined}
              onClick={() => onNav(it.id)}
            >
              <Icon name={it.icon} size={16}/>
              <span>{it.label}</span>
              {it.count !== undefined ? <span className="badge-count num">{it.count}</span> : null}
              {it.shortcut ? <span className="kbd-hint">{it.shortcut.map((k,i) => <Kbd key={i}>{k}</Kbd>)}</span> : null}
            </button>
          ))}
        </React.Fragment>
      ))}
      <div className="sidenav-footer">
        <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--teal-100)', color: 'var(--teal-700)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>KS</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Kochar S.</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }} className="mono">root</div>
        </div>
        <Icon name="chevronDown" size={14} className="muted"/>
      </div>
    </nav>
  );
}

// ============ Command palette ============
function CommandPalette({ open, onClose, onNav }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const all = [
      { group: 'Go to', icon: 'flag', label: 'Flags', kbd: 'g f', run: () => onNav('flags') },
      { group: 'Go to', icon: 'target', label: 'Overrides', kbd: 'g o', run: () => onNav('overrides') },
      { group: 'Go to', icon: 'layers', label: 'Environments', kbd: 'g e', run: () => onNav('environments') },
      { group: 'Go to', icon: 'key', label: 'API keys', kbd: 'g k', run: () => onNav('keys') },
      { group: 'Go to', icon: 'history', label: 'Audit log', kbd: 'g a', run: () => onNav('audit') },
      { group: 'Actions', icon: 'plus', label: 'New flag', kbd: 'n', run: () => onNav('flags:new') },
      { group: 'Actions', icon: 'plus', label: 'New override', run: () => onNav('overrides:new') },
      { group: 'Actions', icon: 'key', label: 'Issue API key', run: () => onNav('keys:new') },
      ...window.FLAGS.map((f) => ({ group: 'Flags', icon: 'flag', label: f.name, meta: f.key, run: () => onNav('flag:' + f.key) })),
    ];
    if (!q.trim()) return all;
    const Q = q.toLowerCase();
    return all.filter((i) => (i.label + ' ' + (i.meta || '')).toLowerCase().includes(Q));
  }, [q, onNav]);

  useEffect(() => {
    if (!open) return;
    setQ(''); setIdx(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') { const it = items[idx]; if (it) { it.run(); onClose(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, idx, onClose]);

  if (!open) return null;

  let lastGroup = null;
  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="input-wrap">
          <Icon name="search" size={16} className="muted"/>
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Type a command or search…"/>
          <span className="kbd-hint"><Kbd>esc</Kbd></span>
        </div>
        <div className="results">
          {items.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No results</div> : null}
          {items.map((it, i) => {
            const showGroup = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <React.Fragment key={i}>
                {showGroup ? <div className="group">{it.group}</div> : null}
                <div className="cmdk-item" data-active={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => { it.run(); onClose(); }}>
                  <Icon name={it.icon} size={14} className="ic"/>
                  <span>{it.label}</span>
                  {it.meta ? <span className="meta mono">{it.meta}</span> : null}
                  {it.kbd ? <span className="meta"><Kbd>{it.kbd.split(' ')[0]}</Kbd>{it.kbd.split(' ')[1] ? <Kbd>{it.kbd.split(' ')[1]}</Kbd> : null}</span> : null}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ Help / shortcuts ============
function HelpPanel({ open, onClose }) {
  const groups = [
    { title: 'Navigation', rows: [
      ['Go to Flags', ['g','f']], ['Go to Overrides', ['g','o']],
      ['Go to Environments', ['g','e']], ['Go to API keys', ['g','k']], ['Go to Audit log', ['g','a']],
    ]},
    { title: 'Global', rows: [
      ['Open command palette', ['⌘','K']], ['Show this panel', ['?']],
      ['Toggle theme', ['⇧','D']], ['Switch project', ['⌘','⇧','P']],
    ]},
    { title: 'Flags page', rows: [
      ['New flag', ['n']], ['Filter', ['/']],
      ['Toggle selected (dev)', ['1']], ['Toggle selected (stg)', ['2']], ['Toggle selected (prod)', ['3']],
      ['Multi-select range', ['⇧','click']],
    ]},
  ];
  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="modal-header">
        <h2>Keyboard shortcuts</h2>
        <div className="sub">Everything in Flagraft is reachable from the keyboard.</div>
      </div>
      <div className="modal-body help-panel">
        <div className="grid-2">
          {groups.map((g) => (
            <div key={g.title}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-4)', fontWeight: 600, marginBottom: 6 }}>{g.title}</div>
              {g.rows.map(([label, keys]) => (
                <div className="row" key={label}>
                  <span className="label">{label}</span>
                  <KbdHint keys={keys}/>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="modal-footer">
        <span className="muted" style={{ fontSize: 12 }}>Press <Kbd>?</Kbd> any time to open this panel.</span>
        <span className="spacer"/>
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

// ============ Project switcher modal ============
function ProjectSwitcher({ open, onClose, current, onSelect }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-header">
        <h2>Switch project</h2>
        <div className="sub">Each project has its own environments, flags, and keys.</div>
      </div>
      <div className="modal-body" style={{ padding: '8px 12px 16px' }}>
        {window.PROJECTS.map((p) => (
          <button
            key={p.id}
            className="cmdk-item"
            data-active={p.id === current.id}
            onClick={() => { onSelect(p); onClose(); }}
            style={{ width: '100%' }}
          >
            <Icon name="layers" size={14} className="ic"/>
            <span>{p.name}</span>
            <span className="meta mono">/{p.slug}</span>
            <span className="meta num" style={{ marginLeft: 8 }}>{p.flagCount} flags</span>
          </button>
        ))}
      </div>
      <div className="modal-footer">
        <Button leftIcon="plus" variant="ghost">New project</Button>
        <span className="spacer"/>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

Object.assign(window, { TopBar, SideNav, CommandPalette, HelpPanel, ProjectSwitcher, NAV });
