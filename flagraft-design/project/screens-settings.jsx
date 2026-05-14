/* global React, Icon, Button, Toggle, Badge, Checkbox, Modal, Tip, Kbd, PageHeader, useToast */
const { useState, useMemo } = React;

// ============================================================
// SCREEN: Project settings
// Layout: sticky section rail + content card, like Stripe's settings.
// ============================================================
function SettingsScreen() {
  const [section, setSection] = useState('general');

  const SECTIONS = [
    { group: 'PROJECT', items: [
      { id: 'general',  label: 'General',         icon: 'settings' },
      { id: 'defaults', label: 'Flag defaults',   icon: 'flag' },
      { id: 'context',  label: 'Context fields',  icon: 'target' },
      { id: 'sdk',      label: 'SDK & evaluation',icon: 'bolt' },
    ]},
    { group: 'ACCESS', items: [
      { id: 'security', label: 'Security',        icon: 'shield' },
      { id: 'members',  label: 'Members & roles', icon: 'user' },
      { id: 'webhooks', label: 'Webhooks',        icon: 'code' },
    ]},
    { group: 'LIFECYCLE', items: [
      { id: 'retention',label: 'Data retention',  icon: 'history' },
      { id: 'danger',   label: 'Transfer & delete', icon: 'alert', danger: true },
    ]},
  ];

  return (
    <div>
      <PageHeader
        title="Project settings"
        sub={<>Configure how <span className="mono" style={{ color: 'var(--text-1)' }}>checkout-web</span> behaves — defaults, access, retention. Settings apply across all environments unless noted.</>}
        actions={<Button variant="ghost" leftIcon="book">Docs</Button>}
      />

      <div className="settings-grid">
        <aside className="settings-rail">
          {SECTIONS.map((g) => (
            <React.Fragment key={g.group}>
              <div className="nav-section">{g.group}</div>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  className="nav-item"
                  aria-current={section === it.id ? 'page' : undefined}
                  data-danger={it.danger ? 'true' : undefined}
                  onClick={() => setSection(it.id)}
                >
                  <Icon name={it.icon} size={15}/>
                  <span>{it.label}</span>
                </button>
              ))}
            </React.Fragment>
          ))}
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-3)' }}>
            Settings are versioned. Every change appears in the <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--pri-fg)' }}>audit log</a> with the acting key.
          </div>
        </aside>

        <section className="settings-content">
          {section === 'general'  ? <SettingsGeneral/>  : null}
          {section === 'defaults' ? <SettingsDefaults/> : null}
          {section === 'context'  ? <SettingsContext/>  : null}
          {section === 'sdk'      ? <SettingsSdk/>      : null}
          {section === 'security' ? <SettingsSecurity/> : null}
          {section === 'members'  ? <SettingsMembers/>  : null}
          {section === 'webhooks' ? <SettingsWebhooks/> : null}
          {section === 'retention'? <SettingsRetention/>: null}
          {section === 'danger'   ? <SettingsDanger/>   : null}
        </section>
      </div>
    </div>
  );
}

// ---------- Building blocks for settings ----------
function SettingsCard({ title, sub, children, footer }) {
  return (
    <div className="card settings-card">
      {title ? (
        <div className="settings-card-head">
          <div>
            <h3>{title}</h3>
            {sub ? <div className="sub">{sub}</div> : null}
          </div>
        </div>
      ) : null}
      <div className="settings-card-body">{children}</div>
      {footer ? <div className="settings-card-foot">{footer}</div> : null}
    </div>
  );
}

function Row({ label, hint, children, full }) {
  return (
    <div className={'settings-row' + (full ? ' full' : '')}>
      <div className="settings-row-label">
        <div className="lbl">{label}</div>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

// ============================================================
// 1. General
// ============================================================
function SettingsGeneral() {
  const toast = useToast();
  const [name, setName] = useState('Checkout Web');
  const [slug, setSlug] = useState('checkout-web');
  const [color, setColor] = useState('teal');
  const [dirty, setDirty] = useState(false);

  return (
    <>
      <SettingsCard
        title="Identity"
        sub="Shown in the project switcher, SDK keys, and audit log."
        footer={<>
          <span className="muted" style={{ fontSize: 12 }}>Last edited <span className="mono">2026-05-09 17:02</span> by <span className="mono">k_a91c</span></span>
          <span className="spacer"/>
          <Button variant="ghost" disabled={!dirty} onClick={() => { setDirty(false); }}>Discard</Button>
          <Button variant="primary" disabled={!dirty} onClick={() => { setDirty(false); toast.push({ title: 'Settings saved' }); }}>Save changes</Button>
        </>}
      >
        <Row label="Display name" hint="Up to 64 characters. Use the team's name for it, not the codename.">
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }}/>
        </Row>
        <Row label="Slug" hint={<>Used in URLs and the SDK config. Changing this rotates all admin keys.</>}>
          <div className="row" style={{ gap: 0, alignItems: 'stretch' }}>
            <span className="input-prefix mono">flagraft.io/p/</span>
            <input className="input mono" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none' }} value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setDirty(true); }}/>
          </div>
        </Row>
        <Row label="Project icon" hint="Two-letter mark and a color swatch for the project switcher.">
          <div className="row" style={{ gap: 12 }}>
            <span className="proj-avatar" data-color={color} aria-hidden="true">{name.slice(0,2).toUpperCase()}</span>
            <div className="row" style={{ gap: 6 }}>
              {['teal','indigo','violet','amber','rose','slate'].map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  aria-pressed={color === c}
                  className="color-swatch"
                  data-color={c}
                  onClick={() => { setColor(c); setDirty(true); }}
                />
              ))}
            </div>
          </div>
        </Row>
        <Row label="Description" hint="Optional context shown on the project switcher tooltip." full>
          <textarea className="input" rows={3} defaultValue="Customer-facing checkout web experience. Owns cart, address, payment, confirmation." onChange={() => setDirty(true)}/>
        </Row>
      </SettingsCard>

      <SettingsCard title="Project metadata">
        <Row label="Project ID">
          <div className="readonly mono">p_4b9c81e2a01f</div>
        </Row>
        <Row label="Created">
          <div className="readonly">
            <span className="mono">2025-09-14</span> · by <span className="mono">k_root</span>
          </div>
        </Row>
        <Row label="Region">
          <div className="row" style={{ gap: 6 }}>
            <Badge tone="slate" dot>eu-west-1</Badge>
            <span className="muted" style={{ fontSize: 12 }}>Data resides in Frankfurt. <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--pri-fg)' }}>Request migration →</a></span>
          </div>
        </Row>
      </SettingsCard>
    </>
  );
}

// ============================================================
// 2. Flag defaults
// ============================================================
function SettingsDefaults() {
  return (
    <>
      <SettingsCard
        title="Defaults for new flags"
        sub="What a flag looks like when it's first created. Per-flag overrides are still possible."
      >
        <Row label="Default state" hint="Whether a new flag starts off or on across all environments.">
          <div className="seg">
            <button className="seg-btn" aria-pressed="true">Off everywhere</button>
            <button className="seg-btn">On in dev, off elsewhere</button>
            <button className="seg-btn">On everywhere</button>
          </div>
        </Row>
        <Row label="Required tags" hint="Authors must apply at least one of these when creating a flag.">
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            <Badge tone="teal">checkout</Badge>
            <Badge tone="teal">experiment</Badge>
            <Badge tone="teal">kill-switch</Badge>
            <Badge tone="slate">infra</Badge>
            <button className="badge add-tag"><Icon name="plus" size={10}/>add</button>
          </div>
        </Row>
        <Row label="Key pattern" hint={<>Validated client-side and on the server. Reject anything that doesn't match.</>}>
          <input className="input mono" defaultValue="^[a-z][a-z0-9.\-]{2,63}$"/>
        </Row>
        <Row label="Force namespace" hint="Require keys to start with one of these prefixes (good for big projects).">
          <div className="row" style={{ gap: 8 }}>
            <Toggle checked={true} onChange={() => {}}/>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              <Badge tone="slate" mono>checkout.</Badge>
              <Badge tone="slate" mono>killswitch.</Badge>
              <Badge tone="slate" mono>auth.</Badge>
              <button className="badge add-tag"><Icon name="plus" size={10}/>add</button>
            </div>
          </div>
        </Row>
        <Row label="Stale flag warning" hint="Flag is flagged as stale after this long without a value change.">
          <select className="select"><option>30 days</option><option>60 days</option><option>90 days</option><option>Never</option></select>
        </Row>
        <Row label="Require description" hint="Authors must write a one-line description before saving.">
          <Toggle checked={true} onChange={() => {}}/>
        </Row>
      </SettingsCard>
    </>
  );
}

// ============================================================
// 2.5 Context fields — the schema that flag rules target on
// ============================================================
function SettingsContext() {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const fields = window.CONTEXT_FIELDS;

  const TYPES = {
    string:  { tone: 'slate', desc: 'Free-form text. Ops: equals, in, regex, starts-with.' },
    enum:    { tone: 'teal',  desc: 'One of a fixed list. Ops: equals, in.' },
    boolean: { tone: 'slate', desc: 'True or false. Ops: is.' },
    number:  { tone: 'slate', desc: 'Integer or float. Ops: =, ≠, <, ≤, >, ≥, between.' },
    version: { tone: 'amber', desc: 'Semver. Ops: =, ≥, ≤, satisfies range.' },
    date:    { tone: 'slate', desc: 'ISO 8601. Ops: before, after, between.' },
  };
  const SOURCES = {
    sdk:      { label: 'SDK',      desc: 'Sent by the client at evaluation time.' },
    server:   { label: 'Server',   desc: 'Looked up from your DB before evaluating.' },
    computed: { label: 'Computed', desc: 'Derived from other fields by a Flagraft expression.' },
  };

  return (
    <>
      <SettingsCard
        title="Context fields"
        sub={<>The attributes flag rules can target on. The SDK sends these alongside each evaluation; Flagraft compares them to your override rules.</>}
      >
        <div className="ctx-intro">
          <pre className="code mono">{`await ff.isEnabled('checkout.new-cart', {
  userId:     'usr_4291',
  cohort:     'beta',
  plan:       'enterprise',
  appVersion: '4.18.2',
});`}</pre>
          <div className="ctx-intro-note">
            <Icon name="info" size={14} className="muted"/>
            <div>
              Only fields registered here can be referenced in <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--pri-fg)' }}>override rules</a>. Unknown keys passed from the SDK are silently ignored — preventing typos like <span className="mono">userid</span> vs <span className="mono">userId</span> from quietly breaking rollouts.
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title={<>Registered fields <span className="muted num" style={{ fontWeight: 400, fontSize: 12.5 }}>· {fields.length}</span></>}
        sub="Add or edit fields here. Changes apply to all flags in this project on next evaluation."
        footer={<>
          <span className="muted" style={{ fontSize: 12 }}>Reserved: <span className="mono">_env</span>, <span className="mono">_flag</span>, <span className="mono">_now</span> are always available.</span>
          <span className="spacer"/>
          <Button variant="ghost" leftIcon="code">Export JSON Schema</Button>
          <Button variant="primary" leftIcon="plus" onClick={() => setShowNew(true)}>Add field</Button>
        </>}
      >
        <table className="settings-table ctx-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Type</th>
              <th>Source</th>
              <th>Example</th>
              <th>Used in</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.key}>
                <td>
                  <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                    <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{f.key}</span>
                    {f.required ? <Badge tone="amber">required</Badge> : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 3, maxWidth: 380 }}>{f.desc}</div>
                </td>
                <td>
                  <Tip tip={TYPES[f.type].desc}>
                    <Badge tone={TYPES[f.type].tone} mono>{f.type}</Badge>
                  </Tip>
                  {f.enumValues ? (
                    <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 6, maxWidth: 220 }}>
                      {f.enumValues.slice(0, 3).map((v) => <span key={v} className="ctx-enum mono">{v}</span>)}
                      {f.enumValues.length > 3 ? <span className="muted" style={{ fontSize: 11 }}>+{f.enumValues.length - 3}</span> : null}
                    </div>
                  ) : null}
                </td>
                <td>
                  <Tip tip={SOURCES[f.source].desc}>
                    <span className="ctx-source" data-source={f.source}>
                      <span className="dot"/>{SOURCES[f.source].label}
                    </span>
                  </Tip>
                </td>
                <td><span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{f.example}</span></td>
                <td>
                  <a href="#" onClick={(e) => e.preventDefault()} className="ctx-usage" title="See flags referencing this field">
                    <Icon name="flag" size={11}/>
                    <span className="num">{f.usedIn}</span>
                    <span style={{ color: 'var(--text-3)' }}>flag{f.usedIn === 1 ? '' : 's'}</span>
                  </a>
                </td>
                <td>
                  <div className="row" style={{ gap: 2 }}>
                    <Tip tip="Edit field"><button className="icon-btn" onClick={() => setEditing(f)}><Icon name="edit" size={13}/></button></Tip>
                    <Tip tip={f.usedIn > 0 ? `In use by ${f.usedIn} flags — can't delete` : 'Delete field'}>
                      <button className="icon-btn" disabled={f.usedIn > 0}><Icon name="trash" size={13}/></button>
                    </Tip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsCard>

      <SettingsCard
        title="How it connects"
        sub="A quick mental model. The flow is the same for every isEnabled() call."
      >
        <div className="ctx-flow">
          <div className="ctx-flow-step">
            <div className="ctx-flow-num">1</div>
            <div>
              <div className="ctx-flow-title">SDK ships context</div>
              <pre className="code mono compact">{`ff.isEnabled('flag', {\n  userId, cohort, plan\n})`}</pre>
              <div className="muted" style={{ fontSize: 12 }}>Fields not registered here are dropped.</div>
            </div>
          </div>
          <Icon name="arrowRight" size={16} className="ctx-flow-arrow"/>
          <div className="ctx-flow-step">
            <div className="ctx-flow-num">2</div>
            <div>
              <div className="ctx-flow-title">Flagraft enriches</div>
              <pre className="code mono compact">{`+ country (from IP)\n+ plan    (from DB)\n+ isInternal = email ~ "@kocharsoft.com"`}</pre>
              <div className="muted" style={{ fontSize: 12 }}>Server + computed fields fill in.</div>
            </div>
          </div>
          <Icon name="arrowRight" size={16} className="ctx-flow-arrow"/>
          <div className="ctx-flow-step">
            <div className="ctx-flow-num">3</div>
            <div>
              <div className="ctx-flow-title">Rules evaluate</div>
              <pre className="code mono compact">{`if cohort = "beta"     → on\nif region = "eu"       → off\nelse                   → default`}</pre>
              <div className="muted" style={{ fontSize: 12 }}>First match wins — rule keys must exist in the registry.</div>
            </div>
          </div>
        </div>
      </SettingsCard>

      <ContextFieldDialog
        open={showNew || !!editing}
        editing={editing}
        onClose={() => { setShowNew(false); setEditing(null); }}
      />
    </>
  );
}

function ContextFieldDialog({ open, editing, onClose }) {
  const [type, setType] = useState(editing?.type || 'string');
  React.useEffect(() => { if (editing) setType(editing.type); }, [editing]);

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="modal-header">
        <h2>{editing ? 'Edit context field' : 'New context field'}</h2>
        <div className="sub">Defines a key that override rules can match on. Changes take effect on next evaluation.</div>
      </div>
      <div className="modal-body">
        <div className="field-row">
          <div className="field">
            <label>Key</label>
            <input className="input mono" autoFocus defaultValue={editing?.key} placeholder="e.g. cohort"/>
            <span className="hint">camelCase. Used verbatim in SDK calls and rule builder.</span>
          </div>
          <div className="field">
            <label>Type</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="string">string</option>
              <option value="enum">enum</option>
              <option value="boolean">boolean</option>
              <option value="number">number</option>
              <option value="version">version</option>
              <option value="date">date</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Description</label>
          <input className="input" defaultValue={editing?.desc} placeholder="What this field means and where it comes from."/>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Source</label>
            <div className="seg">
              <button className="seg-btn" aria-pressed={editing?.source === 'sdk' || !editing}>SDK</button>
              <button className="seg-btn" aria-pressed={editing?.source === 'server'}>Server lookup</button>
              <button className="seg-btn" aria-pressed={editing?.source === 'computed'}>Computed</button>
            </div>
            <span className="hint">Server &amp; computed don't need to be passed by the SDK.</span>
          </div>
          <div className="field">
            <label>Required</label>
            <div className="row" style={{ height: 36 }}><Toggle checked={!!editing?.required} onChange={() => {}}/>
              <span className="muted" style={{ fontSize: 12 }}>Reject evaluations missing this field</span>
            </div>
          </div>
        </div>
        {type === 'enum' ? (
          <div className="field">
            <label>Allowed values</label>
            <input className="input mono" defaultValue={(editing?.enumValues || []).join(', ')} placeholder="control, beta, alpha"/>
            <span className="hint">Comma-separated. Rules can only compare against these values.</span>
          </div>
        ) : null}
        <div className="field">
          <label>Example</label>
          <input className="input mono" defaultValue={editing?.example} placeholder="usr_4291"/>
          <span className="hint">Shown in the rule builder so editors know what shape to expect.</span>
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <span className="spacer"/>
        <Button variant="primary" onClick={onClose}>{editing ? 'Save changes' : 'Add field'}</Button>
      </div>
    </Modal>
  );
}

// ============================================================
// 3. SDK & evaluation
// ============================================================
function SettingsSdk() {
  return (
    <>
      <SettingsCard
        title="SDK behaviour"
        sub="What client SDKs do by default. Each SDK can still override locally."
      >
        <Row label="Polling interval" hint="How often a client refreshes its in-process cache. Lower = fresher, more load.">
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="range" min="5" max="300" defaultValue="30" style={{ width: 220 }}/>
            <span className="mono num" style={{ width: 56, textAlign: 'right' }}>30s</span>
          </div>
        </Row>
        <Row label="Streaming" hint="Push state changes over an SSE connection. Skips polling.">
          <Toggle checked={true} onChange={() => {}}/>
        </Row>
        <Row label="Evaluation timeout" hint="If the SDK can't reach Flagraft within this, fall back to the offline default.">
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input className="input num" defaultValue="250" style={{ width: 80, textAlign: 'right' }}/>
            <span className="muted">ms</span>
          </div>
        </Row>
        <Row label="Offline fallback" hint="What to return when the SDK has never seen this flag before.">
          <div className="seg">
            <button className="seg-btn" aria-pressed="true">off</button>
            <button className="seg-btn">on</button>
            <button className="seg-btn">throw</button>
          </div>
        </Row>
        <Row label="Anonymous evaluations" hint={<>Allow <span className="mono">isEnabled(key)</span> without a user context.</>}>
          <Toggle checked={false} onChange={() => {}}/>
        </Row>
      </SettingsCard>

      <SettingsCard title="Endpoints">
        <Row label="Admin API">
          <CopyField value="https://api.flagraft.io/v1/admin/projects/checkout-web"/>
        </Row>
        <Row label="Evaluation API">
          <CopyField value="https://eval.flagraft.io/v1/checkout-web/{env}"/>
        </Row>
        <Row label="Stream URL">
          <CopyField value="wss://eval.flagraft.io/v1/checkout-web/{env}/stream"/>
        </Row>
      </SettingsCard>
    </>
  );
}

function CopyField({ value }) {
  const toast = useToast();
  return (
    <div className="copy-field">
      <code className="mono">{value}</code>
      <button className="icon-btn" onClick={() => { navigator.clipboard?.writeText(value); toast.push({ title: 'Copied' }); }} aria-label="Copy">
        <Icon name="copy" size={13}/>
      </button>
    </div>
  );
}

// ============================================================
// 4. Security
// ============================================================
function SettingsSecurity() {
  return (
    <>
      <SettingsCard
        title="Production safety"
        sub="Extra friction around changes to protected environments."
      >
        <Row label="Require approval in prod" hint="Two distinct admin keys must approve before a prod toggle takes effect.">
          <Toggle checked={true} onChange={() => {}}/>
        </Row>
        <Row label="Confirm typed slug" hint="When disabling a kill switch in prod, force the user to type the flag key.">
          <Toggle checked={true} onChange={() => {}}/>
        </Row>
        <Row label="Window of caution" hint="Block prod writes during this window unless overridden.">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Toggle checked={true} onChange={() => {}}/>
            <span className="muted">Fri 17:00 – Mon 06:00, UTC</span>
            <Button variant="ghost" size="sm" leftIcon="edit">Edit window</Button>
          </div>
        </Row>
      </SettingsCard>

      <SettingsCard title="Network">
        <Row label="IP allowlist" hint="Restrict admin-key writes to these CIDR ranges. Reads from client keys are unaffected.">
          <div className="ip-list">
            <div className="ip-row">
              <span className="mono">10.0.0.0/8</span>
              <span className="muted" style={{ fontSize: 12 }}>Office VPN</span>
              <span className="spacer"/>
              <button className="icon-btn"><Icon name="trash" size={13}/></button>
            </div>
            <div className="ip-row">
              <span className="mono">203.0.113.42/32</span>
              <span className="muted" style={{ fontSize: 12 }}>CI · GitHub Actions</span>
              <span className="spacer"/>
              <button className="icon-btn"><Icon name="trash" size={13}/></button>
            </div>
            <button className="ip-add"><Icon name="plus" size={12}/>Add range</button>
          </div>
        </Row>
        <Row label="Key TTL" hint="Maximum lifetime for newly-issued admin keys. Client keys are unlimited.">
          <select className="select"><option>90 days (recommended)</option><option>30 days</option><option>180 days</option><option>1 year</option><option>No expiry</option></select>
        </Row>
        <Row label="SSO required" hint={<>Admin keys can only be issued to identities federated through SSO.</>}>
          <div className="row" style={{ gap: 8 }}>
            <Toggle checked={false} onChange={() => {}}/>
            <Badge tone="amber" dot>SSO not configured</Badge>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--pri-fg)', fontSize: 12.5 }}>Set up SAML →</a>
          </div>
        </Row>
      </SettingsCard>
    </>
  );
}

// ============================================================
// 5. Members & roles
// ============================================================
function SettingsMembers() {
  const members = [
    { name: 'Kochar S.',     email: 'kochar@kocharsoft.com', role: 'owner',  initials: 'KS', last: '2 min ago' },
    { name: 'Aida Roussel',  email: 'aida@kocharsoft.com',   role: 'admin',  initials: 'AR', last: '12 min ago' },
    { name: 'Marin Pé',      email: 'marin@kocharsoft.com',  role: 'admin',  initials: 'MP', last: '3 hr ago'  },
    { name: 'Devon Tate',    email: 'devon@kocharsoft.com',  role: 'editor', initials: 'DT', last: 'yesterday' },
    { name: 'Sasha Lin',     email: 'sasha@kocharsoft.com',  role: 'viewer', initials: 'SL', last: 'Apr 28'    },
    { name: 'CI Bot',        email: 'ci@kocharsoft.com',     role: 'editor', initials: 'CB', last: '24s ago', system: true },
  ];
  const roleTone = { owner: 'amber', admin: 'teal', editor: 'slate', viewer: 'slate' };

  return (
    <>
      <SettingsCard
        title="Members"
        sub="Who has direct access to this project. Org-wide roles are managed at the organization level."
        footer={<>
          <span className="muted" style={{ fontSize: 12 }}>{members.length} members · <span className="mono">6/25 seats</span></span>
          <span className="spacer"/>
          <Button variant="ghost" leftIcon="copy">Copy invite link</Button>
          <Button variant="primary" leftIcon="plus">Invite member</Button>
        </>}
      >
        <table className="settings-table">
          <thead>
            <tr><th>Person</th><th>Role</th><th>Last active</th><th></th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.email}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="avatar" data-system={m.system ? 'true' : undefined}>{m.initials}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {m.name}
                        {m.system ? <span style={{ marginLeft: 6 }}><Badge tone="slate">service</Badge></span> : null}
                      </div>
                      <div className="muted mono" style={{ fontSize: 12 }}>{m.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <select className="select role-select" defaultValue={m.role} disabled={m.role === 'owner'}>
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                </td>
                <td><span className="mono muted" style={{ fontSize: 12 }}>{m.last}</span></td>
                <td>
                  <Tip tip={m.role === 'owner' ? 'Transfer ownership first' : 'Remove from project'}>
                    <button className="icon-btn" disabled={m.role === 'owner'}><Icon name="trash" size={13}/></button>
                  </Tip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsCard>

      <SettingsCard title="What each role can do">
        <div className="role-matrix">
          <div className="role-matrix-row head">
            <div></div>
            <div><Badge tone="amber" dot>owner</Badge></div>
            <div><Badge tone="teal" dot>admin</Badge></div>
            <div><Badge tone="slate" dot>editor</Badge></div>
            <div><Badge tone="slate" dot>viewer</Badge></div>
          </div>
          {[
            ['Read flags & overrides', true, true, true, true],
            ['Toggle flags in dev / staging', true, true, true, false],
            ['Toggle flags in production', true, true, false, false],
            ['Manage environments', true, true, false, false],
            ['Issue API keys', true, true, false, false],
            ['Edit project settings', true, true, false, false],
            ['Transfer or delete project', true, false, false, false],
          ].map((r, i) => (
            <div className="role-matrix-row" key={i}>
              <div className="lbl">{r[0]}</div>
              {r.slice(1).map((v, j) => (
                <div key={j}>{v ? <Icon name="check" size={14} style={{ color: 'var(--pri-fg)' }}/> : <Icon name="minus" size={14} className="muted"/>}</div>
              ))}
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}

// ============================================================
// 6. Webhooks
// ============================================================
function SettingsWebhooks() {
  const hooks = [
    { name: 'Slack · #flagraft-alerts', url: 'https://hooks.slack.com/services/T0…/B07…', events: ['flag.enabled', 'flag.disabled', 'override.created'], status: 'ok',   lastFire: '12 min ago' },
    { name: 'PagerDuty · prod killswitches', url: 'https://events.pagerduty.com/integration/c4f…/enqueue', events: ['flag.disabled', 'flag.enabled'], status: 'ok',   lastFire: '4 hr ago' },
    { name: 'Datadog · audit stream', url: 'https://http-intake.logs.datadoghq.eu/v1/input/********', events: ['*'], status: 'fail', lastFire: '3 d ago', err: '401 unauthorized · last 12 attempts' },
  ];
  return (
    <>
      <SettingsCard
        title="Webhooks"
        sub="Push events to external systems. Failures retry with exponential backoff for 24 hours."
        footer={<>
          <span className="muted" style={{ fontSize: 12 }}>Signed with HMAC-SHA256 · header <span className="mono">X-Flagraft-Signature</span></span>
          <span className="spacer"/>
          <Button variant="ghost" leftIcon="play">Send test event</Button>
          <Button variant="primary" leftIcon="plus">Add webhook</Button>
        </>}
      >
        <div className="hook-list">
          {hooks.map((h) => (
            <div key={h.url} className="hook-row">
              <div className="hook-status" data-status={h.status}>
                <span className="dot"/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{h.name}</div>
                <div className="mono muted" style={{ fontSize: 12, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{h.url}</div>
                <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {h.events.map((e) => <Badge key={e} tone="slate" mono>{e}</Badge>)}
                </div>
                {h.err ? (
                  <div className="err" style={{ marginTop: 8 }}>
                    <Icon name="alert" size={11}/>{h.err}
                  </div>
                ) : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="muted" style={{ fontSize: 11.5 }}>Last fire</div>
                <div className="mono" style={{ fontSize: 12 }}>{h.lastFire}</div>
              </div>
              <div className="row" style={{ gap: 2 }}>
                <Tip tip="Edit"><button className="icon-btn"><Icon name="edit" size={13}/></button></Tip>
                <Tip tip="Replay last"><button className="icon-btn"><Icon name="refresh" size={13}/></button></Tip>
                <Tip tip="Delete"><button className="icon-btn"><Icon name="trash" size={13}/></button></Tip>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Subscribable events" sub="Pick any subset when adding a webhook.">
        <div className="event-grid">
          {[
            ['flag.created',       'A flag was created.'],
            ['flag.enabled',       'A flag was switched on in any environment.'],
            ['flag.disabled',      'A flag was switched off in any environment.'],
            ['flag.deleted',       'A flag was removed.'],
            ['override.created',   'A targeting rule or override was added.'],
            ['override.deleted',   'A targeting rule or override was removed.'],
            ['key.issued',         'A new API key was generated.'],
            ['key.revoked',        'An API key was revoked.'],
            ['env.created',        'A new environment was added.'],
            ['settings.changed',   'Project settings were modified.'],
          ].map(([k, d]) => (
            <div key={k} className="event-card">
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{k}</div>
              <div className="muted" style={{ fontSize: 12 }}>{d}</div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}

// ============================================================
// 7. Data retention
// ============================================================
function SettingsRetention() {
  return (
    <>
      <SettingsCard
        title="Retention"
        sub="How long Flagraft holds onto evaluation logs and audit events. Older data is purged at midnight UTC."
      >
        <Row label="Audit log" hint="Every state-changing action. Required for SOC 2.">
          <select className="select"><option>1 year (recommended)</option><option>6 months</option><option>90 days</option><option>30 days</option></select>
        </Row>
        <Row label="Evaluation logs" hint="Per-call records of which value was served. Large.">
          <select className="select"><option>30 days</option><option>14 days</option><option>7 days</option><option>Disabled</option></select>
        </Row>
        <Row label="Override history" hint="Per-flag rule changes. Surface on the flag detail timeline.">
          <select className="select"><option>180 days</option><option>90 days</option><option>30 days</option></select>
        </Row>
        <Row label="Soft-delete window" hint="A deleted flag can be restored from the trash for this long.">
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="range" min="0" max="90" defaultValue="30" style={{ width: 220 }}/>
            <span className="mono num" style={{ width: 56, textAlign: 'right' }}>30 d</span>
          </div>
        </Row>
      </SettingsCard>

      <SettingsCard title="Export & backup">
        <Row label="Daily backup" hint="Encrypted snapshot of flags, overrides, and settings to your S3 bucket.">
          <Toggle checked={true} onChange={() => {}}/>
        </Row>
        <Row label="S3 destination">
          <input className="input mono" defaultValue="s3://kocharsoft-flagraft-backups/checkout-web/"/>
        </Row>
        <Row label="Manual export">
          <div className="row" style={{ gap: 6 }}>
            <Button variant="ghost" leftIcon="code">Export flags (JSON)</Button>
            <Button variant="ghost" leftIcon="code">Export audit (CSV)</Button>
          </div>
        </Row>
      </SettingsCard>
    </>
  );
}

// ============================================================
// 8. Danger zone
// ============================================================
function SettingsDanger() {
  const [archive, setArchive] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [del, setDel] = useState(false);

  return (
    <>
      <div className="danger-banner">
        <Icon name="alert" size={16}/>
        <div>
          <b>These actions are irreversible.</b> They affect every environment, every key, and every running SDK in this project.
        </div>
      </div>

      <SettingsCard title="Transfer ownership" sub="Move this project to another member of your organization. The current owner keeps admin access.">
        <Row label="Current owner">
          <div className="row" style={{ gap: 10 }}>
            <span className="avatar">KS</span>
            <div>
              <div style={{ fontWeight: 600 }}>Kochar S.</div>
              <div className="muted mono" style={{ fontSize: 12 }}>kochar@kocharsoft.com</div>
            </div>
          </div>
        </Row>
        <Row label="Transfer to">
          <select className="select"><option>Select a member…</option><option>Aida Roussel · admin</option><option>Marin Pé · admin</option></select>
        </Row>
        <Row label="">
          <Button variant="ghost" onClick={() => setTransfer(true)}>Transfer project →</Button>
        </Row>
      </SettingsCard>

      <SettingsCard title="Archive project" sub="Freezes flag state. The SDK still evaluates, but nothing can be edited until it's unarchived.">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-3)' }}>
            Archived projects don't count toward your seat or flag quotas. You can unarchive at any time.
          </div>
          <Button variant="ghost" onClick={() => setArchive(true)}>Archive project</Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Delete project" sub="Permanent. All flags, overrides, keys, and history are removed.">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-3)' }}>
            <span className="num"><b>24</b> flags</span>, <span className="num"><b>62</b> overrides</span>, <span className="num"><b>4</b> environments</span> and <span className="num"><b>9</b> API keys</span> will be deleted. Backups in your S3 bucket are not touched.
          </div>
          <Button variant="danger" onClick={() => setDel(true)}>Delete project…</Button>
        </div>
      </SettingsCard>

      <ArchiveDialog open={archive} onClose={() => setArchive(false)}/>
      <TransferDialog open={transfer} onClose={() => setTransfer(false)}/>
      <DeleteDialog open={del} onClose={() => setDel(false)}/>
    </>
  );
}

function ArchiveDialog({ open, onClose }) {
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-header">
        <h2>Archive Checkout Web?</h2>
        <div className="sub">SDKs keep evaluating the last known state. No edits are possible until you unarchive.</div>
      </div>
      <div className="modal-body">
        <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 12.5 }}>
          <div className="row" style={{ marginBottom: 4 }}><Icon name="info" size={13} className="muted"/><b>What happens</b></div>
          <ul style={{ margin: '6px 0 0 24px', padding: 0, color: 'var(--text-2)', lineHeight: 1.7 }}>
            <li>Read traffic continues to serve cached values.</li>
            <li>Write attempts return <span className="mono">423 Locked</span>.</li>
            <li>Project disappears from the active switcher.</li>
          </ul>
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <span className="spacer"/>
        <Button variant="primary" onClick={() => { onClose(); toast.push({ title: 'Project archived', msg: 'Unarchive any time from the org dashboard.' }); }}>Archive</Button>
      </div>
    </Modal>
  );
}

function TransferDialog({ open, onClose }) {
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-header">
        <h2>Transfer ownership to Aida Roussel?</h2>
        <div className="sub">Aida will become the new owner. You'll keep admin access and can be re-promoted.</div>
      </div>
      <div className="modal-body">
        <div className="field">
          <label>Type the project slug to confirm</label>
          <input className="input mono" placeholder="checkout-web"/>
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <span className="spacer"/>
        <Button variant="primary" onClick={() => { onClose(); toast.push({ title: 'Invitation sent', msg: 'Aida has 7 days to accept.' }); }}>Send transfer invite</Button>
      </div>
    </Modal>
  );
}

function DeleteDialog({ open, onClose }) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const ok = typed === 'checkout-web';
  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alert" size={18} style={{ color: 'var(--danger-fg)' }}/>
          Delete Checkout Web
        </h2>
        <div className="sub">This action is irreversible. SDK clients will receive <span className="mono">404</span> from the next evaluation onward.</div>
      </div>
      <div className="modal-body">
        <div style={{
          padding: 12, background: 'var(--danger-soft)',
          border: '1px solid var(--danger-soft-border)', borderRadius: 8,
          color: 'var(--danger-fg)', fontSize: 12.5,
        }}>
          <b>24 flags · 62 overrides · 4 environments · 9 API keys</b> will be permanently deleted. Soft-delete recovery does <b>not</b> apply at the project level.
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Type <span className="mono">checkout-web</span> to confirm</label>
          <input className="input mono" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} aria-invalid={typed && !ok ? 'true' : undefined}/>
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <span className="spacer"/>
        <Button variant="danger" disabled={!ok} onClick={() => { onClose(); toast.push({ kind: 'error', title: 'Project queued for deletion', msg: 'Final purge in 24 hours.' }); }}>Delete forever</Button>
      </div>
    </Modal>
  );
}

Object.assign(window, { SettingsScreen });
