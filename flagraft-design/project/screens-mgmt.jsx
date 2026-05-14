/* global React, Icon, Button, Toggle, Badge, Checkbox, Modal, useToast, PageHeader, Tip, Kbd, KbdHint */
const { useState, useEffect, useMemo } = React;

// ============================================================
// SCREEN: Environments
// ============================================================
function EnvironmentsScreen() {
  const [showNew, setShowNew] = useState(false);
  const envs = [
    { ...window.ENVS[0], flags: 24, keys: 2, defaultOn: 14 },
    { ...window.ENVS[1], flags: 24, keys: 2, defaultOn: 9 },
    { ...window.ENVS[2], flags: 24, keys: 3, defaultOn: 4 },
    { id: 'e_prv', slug: 'preview', name: 'Preview', color: 'slate', protected: false, flags: 24, keys: 0, defaultOn: 0 },
  ];
  return (
    <div>
      <PageHeader
        title="Environments"
        sub="Flag state is scoped per environment. Each environment can have its own keys and overrides."
        actions={<Button variant="primary" leftIcon="plus" onClick={() => setShowNew(true)}>New environment</Button>}
      />

      <div className="grid-2">
        {envs.map((e) => (
          <div key={e.slug} className="card" style={{ padding: 20, position: 'relative' }}>
            <div className="row" style={{ marginBottom: 14 }}>
              <span className="badge" style={{
                background: e.color === 'red' ? 'var(--danger-soft)' : e.color === 'amber' ? 'var(--acc-soft)' : e.color === 'teal' ? 'var(--pri-soft)' : 'var(--bg-subtle)',
                borderColor: e.color === 'red' ? 'var(--danger-soft-border)' : e.color === 'amber' ? 'var(--acc-soft-border)' : e.color === 'teal' ? 'var(--pri-soft-border)' : 'var(--border)',
                color: e.color === 'red' ? 'var(--danger-fg)' : e.color === 'amber' ? 'var(--acc-fg)' : e.color === 'teal' ? 'var(--pri-fg)' : 'var(--text-2)',
              }}>
                <span className="dot" style={{
                  background: e.color === 'red' ? 'var(--red-500)' : e.color === 'amber' ? 'var(--amber-500)' : e.color === 'teal' ? 'var(--teal-500)' : 'var(--ink-400)',
                }}/>
                {e.name}
              </span>
              {e.protected ? <Tip tip="Protected — destructive changes require confirmation"><Badge tone="red"><Icon name="shield" size={10}/> protected</Badge></Tip> : null}
              <span className="spacer"/>
              <Tip tip="Edit environment"><button className="icon-btn"><Icon name="edit" size={14}/></button></Tip>
              {!e.protected ? <Tip tip="Delete environment"><button className="icon-btn"><Icon name="trash" size={14}/></button></Tip> : null}
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>/{e.slug}</div>

            <div className="grid-3" style={{ gap: 8 }}>
              {[
                { l: 'Flags', v: e.flags },
                { l: 'On by default', v: e.defaultOn },
                { l: 'Client keys', v: e.keys },
              ].map((s) => (
                <div key={s.l} style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                  <div className="muted" style={{ fontSize: 11 }}>{s.l}</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{s.v}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }} className="row">
              <span className="muted" style={{ fontSize: 12 }}>Base URL</span>
              <code className="mono" style={{ fontSize: 12 }}>api.flagraft.io/v1/{e.slug}</code>
              <span className="spacer"/>
              <Button size="sm" variant="ghost" leftIcon="copy">Copy</Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)}>
        <div className="modal-header"><h2>New environment</h2><div className="sub">Cloned from <span className="mono">production</span> defaults.</div></div>
        <div className="modal-body">
          <div className="field"><label>Name</label><input className="input" placeholder="e.g. Preview" autoFocus/></div>
          <div className="field"><label>Slug</label><input className="input mono" placeholder="preview"/><span className="hint">Used in URLs and SDK config. Lowercase, no spaces.</span></div>
          <div className="field-row">
            <div className="field">
              <label>Protected</label>
              <div className="row" style={{ height: 36 }}><Toggle checked={false} onChange={() => {}} /><span className="muted" style={{ fontSize: 12 }}>Require confirmation for changes</span></div>
            </div>
            <div className="field">
              <label>Clone state from</label>
              <select className="select"><option>production</option><option>staging</option><option>(empty)</option></select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          <span className="spacer"/>
          <Button variant="primary">Create environment</Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// SCREEN: API keys
// ============================================================
function KeysScreen() {
  const toast = useToast();
  const [revealKey, setRevealKey] = useState(null); // newly created
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <PageHeader
        title="API keys"
        sub="Three tiers: root (full access), project admin, and client (one environment, evaluations only)."
        actions={<Button variant="primary" leftIcon="plus" onClick={() => setShowNew(true)}>Issue key</Button>}
      />

      <div className="card">
        <table className="flag-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Scope</th>
              <th>Prefix</th>
              <th>Last used</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {window.API_KEYS.map((k) => (
              <tr key={k.id} style={{ cursor: 'default' }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{k.label}</div>
                  {k.project ? <div className="muted" style={{ fontSize: 12 }}>{k.project}{k.env ? <> · <span className="mono">{k.env}</span></> : null}</div> : null}
                </td>
                <td>
                  {k.scope === 'root' ? <Badge tone="amber" dot>root</Badge> :
                   k.scope === 'admin' ? <Badge tone="teal" dot>admin</Badge> :
                   <Badge tone="slate" dot>client</Badge>}
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 12.5 }}>{k.prefix}<span className="muted">…••••••••</span></span>
                </td>
                <td><span className="mono" style={{ fontSize: 12 }}>{k.lastUsed}</span></td>
                <td><span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{k.created}</span></td>
                <td>
                  <div className="row">
                    <Tip tip="Copy prefix"><button className="icon-btn"><Icon name="copy" size={14}/></button></Tip>
                    <Tip tip="Revoke"><button className="icon-btn"><Icon name="trash" size={14}/></button></Tip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: 16, padding: 14,
        background: 'var(--acc-soft)', border: '1px solid var(--acc-soft-border)',
        borderRadius: 8, display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12,
      }}>
        <Icon name="shield" size={18} className="ico" style={{ color: 'var(--acc-fg)' }}/>
        <div style={{ fontSize: 12.5 }}>
          <b style={{ color: 'var(--acc-fg)' }}>Keys are shown once.</b> Flagraft only stores a hash, so we can't recover the plaintext. Rotate immediately if a key leaks — old keys can be revoked while the new one is issued.
        </div>
      </div>

      {/* New key dialog */}
      <Modal open={showNew} onClose={() => setShowNew(false)}>
        <div className="modal-header">
          <h2>Issue API key</h2>
          <div className="sub">The plaintext key is shown <b>only once</b> after creation.</div>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Label</label>
            <input className="input" placeholder="e.g. CI / e2e tests"/>
          </div>
          <div className="field">
            <label>Scope</label>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn primary">admin</button>
              <button className="btn">client</button>
            </div>
            <span className="hint">Admin keys can read and write flags. Client keys only evaluate.</span>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Project</label>
              <select className="select"><option>Checkout Web</option><option>Mobile API</option></select>
            </div>
            <div className="field">
              <label>Environment <span className="muted" style={{ fontSize: 11 }}>· client only</span></label>
              <select className="select" disabled><option>—</option></select>
            </div>
          </div>
          <div className="field">
            <label>Expires</label>
            <select className="select"><option>Never</option><option>90 days</option><option>30 days</option><option>7 days</option></select>
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          <span className="spacer"/>
          <Button variant="primary" onClick={() => {
            setShowNew(false);
            setRevealKey('ff_ad_' + Math.random().toString(36).slice(2, 8) + 'd1f8b3a02e7c4a17e9f2');
          }}>Generate key</Button>
        </div>
      </Modal>

      {/* One-time reveal */}
      <Modal open={!!revealKey} onClose={() => setRevealKey(null)}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="shield" size={18} style={{ color: 'var(--acc-fg)' }}/>
            Save this key now
          </h2>
          <div className="sub">You won't be able to see it again. Closing this dialog is the same as the key being lost.</div>
        </div>
        <div className="modal-body">
          <div style={{
            background: '#0b1220', color: '#e4f7f3', padding: 14, borderRadius: 8,
            fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all',
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center',
            border: '1px solid #1f2a40',
          }}>
            <span>{revealKey}</span>
            <button className="btn sm" style={{ background: '#172238', color: '#e4f7f3', border: '1px solid #2a3855' }} onClick={() => {
              navigator.clipboard?.writeText(revealKey || '');
              toast.push({ title: 'Key copied to clipboard' });
            }}><Icon name="copy" size={12}/>Copy</button>
          </div>
          <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-subtle)', borderRadius: 8 }}>
            <div className="row" style={{ marginBottom: 6, fontSize: 12.5, fontWeight: 600 }}><Icon name="info" size={13}/>Use it like this</div>
            <pre className="code" style={{ background: 'var(--bg-elev)' }}>
{`curl https://api.flagraft.io/v1/admin/projects/checkout-web/flags \\
  -H "Authorization: ${revealKey || ''}"`}
            </pre>
          </div>
        </div>
        <div className="modal-footer">
          <span className="muted" style={{ fontSize: 12 }}>Stored as a SHA-256 hash. Plaintext is not recoverable.</span>
          <span className="spacer"/>
          <Button variant="primary" onClick={() => { setRevealKey(null); toast.push({ title: 'Key created', msg: 'Make sure you saved the plaintext.' }); }}>I've saved it</Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// SCREEN: Audit log
// ============================================================
function AuditScreen() {
  const [actor, setActor] = useState('all');
  const [env, setEnv] = useState('all');
  const grouped = useMemo(() => {
    const xs = window.AUDIT.filter((a) =>
      (actor === 'all' || a.actor === actor) && (env === 'all' || a.env === env)
    );
    const m = {};
    xs.forEach((a) => { if (!m[a.day]) m[a.day] = []; m[a.day].push(a); });
    return m;
  }, [actor, env]);

  const typeIcon = {
    enable: 'check', disable: 'x', override: 'target',
    create: 'plus', keyIssued: 'key', envCreated: 'layers',
  };
  const typeTone = {
    enable: 'teal', disable: 'slate', override: 'amber',
    create: 'teal', keyIssued: 'amber', envCreated: 'slate',
  };

  return (
    <div>
      <PageHeader title="Audit log" sub="Every state-changing action across this project — actor, when, what." actions={
        <>
          <Button variant="ghost" leftIcon="code">Export JSON</Button>
          <Button variant="ghost" leftIcon="copy">Stream URL</Button>
        </>
      }/>

      <div className="card">
        <div className="flags-toolbar">
          <div className="row" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>Actor</span>
            <select className="select" style={{ height: 30, width: 'auto' }} value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="all">All</option>
              <option value="k_root">k_root</option>
              <option value="k_a91c">k_a91c</option>
              <option value="k_2f10">k_2f10</option>
            </select>
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>Env</span>
            <select className="select" style={{ height: 30, width: 'auto' }} value={env} onChange={(e) => setEnv(e.target.value)}>
              <option value="all">All</option>
              <option value="development">development</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </div>
          <span className="spacer"/>
          <span className="muted mono" style={{ fontSize: 12 }}>Showing last 30 days</span>
        </div>

        <div style={{ padding: '4px 14px 14px' }}>
          {Object.entries(grouped).map(([day, rows]) => (
            <React.Fragment key={day}>
              <div className="audit-day">{day}</div>
              {rows.map((r, i) => (
                <div className="audit-row" key={i}>
                  <div className="when">{r.when}</div>
                  <div className="what" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span className="badge" style={{
                      width: 22, height: 22, padding: 0, justifyContent: 'center',
                      background: 'var(--bg-subtle)',
                    }}>
                      <Icon name={typeIcon[r.type] || 'info'} size={12}/>
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="lead" dangerouslySetInnerHTML={{ __html: r.desc.replace(/`([^`]+)`/g, '<span class="mono" style="font-size:12.5px;color:var(--text-1)">$1</span>') }}/>
                      <div className="actor mono">by {r.actor}{r.env ? <> · {r.env}</> : null}</div>
                    </div>
                    <Badge tone={typeTone[r.type] || 'slate'}>{r.type}</Badge>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SCREEN: Onboarding / first run
// ============================================================
function OnboardingScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      label: 'Welcome',
      ill: (
        <div style={{ display: 'grid', placeItems: 'center', padding: 28 }}>
          <div style={{
            width: 96, height: 96, borderRadius: 24,
            background: 'linear-gradient(135deg, var(--teal-400), var(--teal-700))',
            color: '#06322c', display: 'grid', placeItems: 'center',
            fontWeight: 800, fontSize: 36, letterSpacing: '-0.02em',
            boxShadow: '0 12px 32px rgba(13, 148, 136, 0.35)',
          }}>FR</div>
        </div>
      ),
      title: 'Welcome to Flagraft',
      body: <>You're running <b>v1.4</b> on Postgres. Let's walk through the four things you'll need to ship a feature behind a flag.</>,
      next: 'Get started',
    },
    {
      label: 'Project',
      ill: <StepIll icon="layers"/>,
      title: 'Create a project',
      body: <>One project per application. Each project gets <span className="mono">development</span>, <span className="mono">staging</span>, and <span className="mono">production</span> environments out of the box.</>,
      content: (
        <div className="field" style={{ marginTop: 14 }}>
          <label>Project name</label>
          <input className="input" placeholder="e.g. Checkout Web" defaultValue="Checkout Web"/>
          <div className="hint">Slug: <span className="mono">checkout-web</span> · auto-generated</div>
        </div>
      ),
      next: 'Create project',
    },
    {
      label: 'Key',
      ill: <StepIll icon="key"/>,
      title: 'Issue an admin key',
      body: <>Admin keys let your team manage flags in this project. The root key (from <span className="mono">pnpm admin:create-root-key</span>) stays in your password manager.</>,
      content: (
        <pre className="code" style={{ marginTop: 14 }}>{`✓ Project admin key issued
ff_ad_a91c8b3f29d4e7c1b2a04f88d5e6c7
Copy this — it won't be shown again.`}</pre>
      ),
      next: 'Got it',
    },
    {
      label: 'Flag',
      ill: <StepIll icon="flag"/>,
      title: 'Create your first flag',
      body: <>Flags start off in every environment. Wire your code first, deploy, then flip in staging when you're ready.</>,
      content: (
        <pre className="code" style={{ marginTop: 14 }}>{`if (await ff.isEnabled('hello-world', { userId })) {
  // new behaviour
}`}</pre>
      ),
      next: 'Create flag',
    },
    {
      label: 'Ship',
      ill: <StepIll icon="bolt"/>,
      title: "You're ready",
      body: <>Open the Flags page to see your new flag. From there, toggle per environment, add overrides, and watch evaluations roll in.</>,
      next: 'Take me to Flags',
    },
  ];

  const cur = steps[step];

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
      <div className="card" style={{ width: 560, padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.label}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: i <= step ? 'var(--pri-fg)' : 'var(--text-4)',
                fontWeight: i === step ? 600 : 500, fontSize: 12.5,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 999,
                  display: 'grid', placeItems: 'center',
                  background: i < step ? 'var(--pri)' : i === step ? 'var(--pri-soft)' : 'var(--bg-subtle)',
                  color: i < step ? '#042b27' : i === step ? 'var(--pri-fg)' : 'var(--text-4)',
                  border: '1px solid', borderColor: i < step ? 'var(--pri)' : i === step ? 'var(--pri-soft-border)' : 'var(--border)',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {i < step ? <Icon name="check" size={11}/> : i + 1}
                </span>
                <span>{s.label}</span>
              </div>
              {i < steps.length - 1 ? <div style={{ flex: 1, height: 1, background: i < step ? 'var(--pri)' : 'var(--border)' }}/> : null}
            </React.Fragment>
          ))}
        </div>

        {cur.ill}

        <div style={{ padding: '4px 28px 24px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>{cur.title}</h2>
          <p style={{ color: 'var(--text-3)', marginTop: 8, fontSize: 13.5 }}>{cur.body}</p>
          {cur.content ? <div style={{ textAlign: 'left' }}>{cur.content}</div> : null}
        </div>

        <div className="modal-footer">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          <span className="spacer"/>
          <span className="muted" style={{ fontSize: 12 }}>{step + 1} / {steps.length}</span>
          <Button variant="primary" onClick={() => {
            if (step === steps.length - 1) onDone();
            else setStep(step + 1);
          }}>{cur.next} <Icon name="arrowRight" size={12}/></Button>
        </div>
      </div>
    </div>
  );
}
function StepIll({ icon }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 28 }}>
      <div style={{
        width: 96, height: 96, borderRadius: 24,
        background: 'var(--pri-soft)', border: '1px solid var(--pri-soft-border)',
        color: 'var(--pri)', display: 'grid', placeItems: 'center',
      }}>
        <Icon name={icon} size={36}/>
      </div>
    </div>
  );
}

// ============================================================
// SCREEN: Degraded / error states (a single screen showing all)
// ============================================================
function ErrorStatesScreen() {
  return (
    <div>
      <PageHeader
        title="Degraded states"
        sub="What the admin UI shows when things go wrong. These appear contextually, not as their own page."
      />

      <div className="grid-2">
        <ErrorCard
          icon="wifiOff" tone="red"
          title="Can't reach the Flagraft server"
          msg="The admin UI lost its connection. SDK clients keep serving their cached values; nothing in your app changes."
          cta={<><Button variant="ghost" leftIcon="refresh">Retry now</Button><Button variant="ghost">Run /ready check</Button></>}
          meta={<>Last contact <span className="mono">12s ago</span> · auto-retrying every <span className="mono">5s</span></>}
        />

        <ErrorCard
          icon="alert" tone="red"
          title="Database unreachable"
          msg={<><span className="mono">GET /ready</span> returned <b className="mono" style={{ color: 'var(--danger-fg)' }}>503</b>. Reads continue from the in-process cache; writes are paused until the DB returns.</>}
          cta={<Button variant="ghost" leftIcon="book">Open runbook</Button>}
          meta={<>Affected: <span className="mono">writes</span> · cache TTL <span className="mono">30s</span></>}
        />

        <ErrorCard
          icon="shield" tone="amber"
          title="Acting key is read-only"
          msg="You're authenticated with a client key. You can browse, but you can't toggle flags or edit overrides. Switch keys to make changes."
          cta={<Button variant="primary">Switch key</Button>}
          meta={<>Current scope: <span className="mono">client / production</span></>}
        />

        <ErrorCard
          icon="alert" tone="amber"
          title="Rate limit reached"
          msg={<>You hit <b className="num">100</b> client evaluations per minute from this IP. Existing in-process SDK caches still serve. New requests get <span className="mono">429</span>.</>}
          cta={<Button variant="ghost" leftIcon="settings">Adjust limits</Button>}
          meta={<>Window resets in <span className="mono num">00:42</span></>}
        />

        <ErrorCard
          icon="info" tone="slate"
          title="Stale data"
          msg={<>Showing data from <span className="mono">14:32:08</span>. Your browser tab was backgrounded — the live socket reconnects automatically when you return.</>}
          cta={<Button variant="ghost" leftIcon="refresh">Refresh now</Button>}
          meta={<>Drift: <span className="mono num">+2m 14s</span></>}
        />

        <ErrorCard
          icon="alert" tone="red"
          title="Validation failed"
          msg={<>The flag key <span className="mono">checkout new cart</span> contains a space. Keys must match <span className="mono">^[a-z0-9._-]+$</span>.</>}
          cta={<Button variant="primary">Fix key</Button>}
          meta={<>Hint: <span className="mono">checkout.new-cart</span></>}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Inline error patterns</div>
        <div className="card" style={{ padding: 20 }}>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Slug</label>
            <input className="input mono" defaultValue="checkout web" aria-invalid="true" style={{ borderColor: 'var(--danger)' }}/>
            <span className="err"><Icon name="alert" size={11}/> Must be lowercase, alphanumeric, hyphens only.</span>
          </div>
          <div style={{
            padding: '10px 12px', background: 'var(--danger-soft)',
            border: '1px solid var(--danger-soft-border)', borderRadius: 8,
            color: 'var(--danger-fg)', fontSize: 12.5,
            display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 10, alignItems: 'center',
          }}>
            <Icon name="alert" size={14}/>
            <span>Failed to disable <span className="mono">checkout.new-cart</span> in production — <span className="mono">409 Conflict</span>. Someone else just edited this flag.</span>
            <Button size="sm" variant="ghost">Reload</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ icon, tone, title, msg, cta, meta }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10,
          background: tone === 'red' ? 'var(--danger-soft)' : tone === 'amber' ? 'var(--acc-soft)' : 'var(--bg-subtle)',
          color: tone === 'red' ? 'var(--danger-fg)' : tone === 'amber' ? 'var(--acc-fg)' : 'var(--text-3)',
          border: '1px solid',
          borderColor: tone === 'red' ? 'var(--danger-soft-border)' : tone === 'amber' ? 'var(--acc-soft-border)' : 'var(--border)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <Icon name={icon} size={18}/>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
          <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 4 }}>{msg}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{meta}</div>
          <div className="row" style={{ marginTop: 12, gap: 6 }}>{cta}</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EnvironmentsScreen, KeysScreen, AuditScreen, OnboardingScreen, ErrorStatesScreen });
