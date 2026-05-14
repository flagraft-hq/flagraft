/* global React, Icon, Button, Toggle, Badge, Checkbox, PageHeader, Kbd */
const { useState } = React;

// ============================================================
// SCREEN: Design system
// ============================================================
function DesignSystemScreen() {
  return (
    <div>
      <PageHeader
        title="Flagraft Admin — Design system"
        sub="The tokens, components, and rationale behind this prototype. Built for the people who live in this tool at 2am."
        actions={<Button variant="ghost" leftIcon="copy">Copy tokens.css</Button>}
      />

      <Section title="Design rationale" icon="sparkles">
        <div className="grid-2">
          <RationaleCard
            n="1"
            title="An operator's console, not a marketing page"
            body="Flagraft users are engineers debugging a production incident or rolling out a risky feature. The UI is dense, monospace-friendly, and rewards muscle memory. Every page is reachable in two keystrokes."
          />
          <RationaleCard
            n="2"
            title="Three environments, one row"
            body="The job-to-be-done on the flags list is: 'is X on in prod, right now?' Every flag answers that question on a single line — toggle, default state, override count — without scrolling or hovering."
          />
          <RationaleCard
            n="3"
            title="Production wears red"
            body="Prod toggles get a red outline when on. Prod actions go through a typed confirmation. Audit and key indicators surface scope so you always know which key you're acting as."
          />
          <RationaleCard
            n="4"
            title="Teal for the calm path"
            body="Brand teal #2dd4bf signals 'normal, on, healthy.' Amber signals 'configured but unusual' (overrides, expirations). Red is reserved for production-touching and destructive actions. Slate carries everything else."
          />
        </div>
      </Section>

      <Section title="Color tokens" icon="palette">
        <div className="card" style={{ padding: 18 }}>
          <ColorRamp label="Teal · primary" prefix="teal" tokens={['50','100','200','300','400','500','600','700','800','900']}/>
          <ColorRamp label="Amber · accent (overrides, warnings)" prefix="amber" tokens={['50','100','200','300','400','500','600','700']}/>
          <ColorRamp label="Red · production / destructive" prefix="red" tokens={['50','100','300','500','600','700']}/>
          <ColorRamp label="Ink · neutral ramp" prefix="ink" tokens={['0','50','100','200','300','400','500','600','700','800','900','950']}/>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Semantic — Light</h4>
            <SemanticRow label="bg-app" var_="--bg-app" theme="light"/>
            <SemanticRow label="bg-elev" var_="--bg-elev" theme="light"/>
            <SemanticRow label="bg-subtle" var_="--bg-subtle" theme="light"/>
            <SemanticRow label="border" var_="--border" theme="light"/>
            <SemanticRow label="text-1" var_="--text-1" theme="light"/>
            <SemanticRow label="text-3" var_="--text-3" theme="light"/>
            <SemanticRow label="pri" var_="--pri" theme="light"/>
            <SemanticRow label="danger" var_="--danger" theme="light"/>
          </div>
          <div className="card theme-dark" style={{ padding: 18, background: 'var(--bg-elev)' }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Semantic — Dark</h4>
            <SemanticRow label="bg-app" var_="--bg-app" theme="dark"/>
            <SemanticRow label="bg-elev" var_="--bg-elev" theme="dark"/>
            <SemanticRow label="bg-subtle" var_="--bg-subtle" theme="dark"/>
            <SemanticRow label="border" var_="--border" theme="dark"/>
            <SemanticRow label="text-1" var_="--text-1" theme="dark"/>
            <SemanticRow label="text-3" var_="--text-3" theme="dark"/>
            <SemanticRow label="pri" var_="--pri" theme="dark"/>
            <SemanticRow label="danger" var_="--danger" theme="dark"/>
          </div>
        </div>
      </Section>

      <Section title="Typography" icon="code">
        <div className="card" style={{ padding: 24 }}>
          <TypeRow size={26} weight={600} name="Display / h1" sample="Feature flags" font="sans" tracking="-0.01em"/>
          <TypeRow size={18} weight={600} name="Section / h2" sample="Override rules in production" font="sans" tracking="-0.01em"/>
          <TypeRow size={14} weight={600} name="Card title / h3" sample="Last 14 days" font="sans"/>
          <TypeRow size={13.5} weight={500} name="Body" sample="Disabling 3 flags in production. Existing overrides will still apply." font="sans"/>
          <TypeRow size={12} weight={400} name="Caption" sample="Last evaluated 14ms ago · p99 22ms" font="sans"/>
          <TypeRow size={11} weight={600} name="Eyebrow" sample="WORKSPACE" font="sans" upper/>
          <TypeRow size={13} weight={500} name="Mono — keys & values" sample="checkout.new-cart  ff_ad_a91c…  cohort=beta" font="mono"/>
          <TypeRow size={12} weight={500} name="Mono caption" sample="GET /api/v1/client/features?userId=usr_123" font="mono"/>
        </div>
      </Section>

      <Section title="Spacing, radius, shadow" icon="layers">
        <div className="grid-3">
          <div className="card" style={{ padding: 18 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Spacing · 4px base</h4>
            <div className="col" style={{ marginTop: 12, gap: 6 }}>
              {[
                ['s-1', 4], ['s-2', 8], ['s-3', 12], ['s-4', 16],
                ['s-5', 20], ['s-6', 24], ['s-8', 32], ['s-12', 48],
              ].map(([n, v]) => (
                <div className="row" key={n} style={{ fontSize: 12 }}>
                  <span className="mono" style={{ width: 50, color: 'var(--text-3)' }}>{n}</span>
                  <div style={{ width: v, height: 12, background: 'var(--teal-400)', borderRadius: 3 }}/>
                  <span className="mono muted">{v}px</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Radius</h4>
            <div className="row" style={{ marginTop: 14, gap: 14, alignItems: 'flex-end' }}>
              {[['sm', 6], ['md', 8], ['lg', 10], ['xl', 12], ['pill', 999]].map(([n, v]) => (
                <div key={n} style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: v }}/>
                  <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>r-{n}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Elevation</h4>
            <div className="row" style={{ marginTop: 14, gap: 14, alignItems: 'flex-end' }}>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, background: 'var(--bg-elev)', borderRadius: 10, boxShadow: `var(--shadow-${n})`, border: '1px solid var(--border)' }}/>
                  <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>shadow-{n}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Components" icon="bolt">
        <div className="grid-2">
          <ComponentCard title="Toggle — the workhorse">
            <div className="col" style={{ gap: 14 }}>
              <div className="row"><Toggle size="sm" checked={true} onChange={() => {}}/><span className="muted">small</span></div>
              <div className="row"><Toggle checked={true} onChange={() => {}}/><span className="muted">medium · default</span></div>
              <div className="row"><Toggle size="lg" checked={true} onChange={() => {}}/><span className="muted">large · detail view</span></div>
              <div className="row"><Toggle production checked={true} onChange={() => {}}/><span style={{ color: 'var(--danger-fg)' }}>production · red ring when on</span></div>
              <div className="row"><Toggle checked={false} onChange={() => {}}/><span className="muted">off</span></div>
            </div>
          </ComponentCard>

          <ComponentCard title="Buttons">
            <div className="col" style={{ gap: 10 }}>
              <div className="row"><Button variant="primary">Primary</Button><Button>Default</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button><Button variant="danger" className="solid">Solid danger</Button></div>
              <div className="row"><Button size="sm" variant="primary">Small</Button><Button size="sm">Small</Button><Button size="sm" variant="ghost">Small</Button></div>
              <div className="row"><Button variant="primary" leftIcon="plus">With icon</Button><Button leftIcon="copy">Copy</Button><Button variant="ghost" leftIcon="refresh">Refresh</Button></div>
              <div className="row"><Button disabled>Disabled</Button><Button variant="primary" disabled>Disabled</Button></div>
            </div>
          </ComponentCard>

          <ComponentCard title="Badges & chips">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <Badge tone="teal" dot>enabled</Badge>
              <Badge tone="amber" dot>3 overrides</Badge>
              <Badge tone="red" dot>production</Badge>
              <Badge tone="slate" dot>development</Badge>
              <Badge tone="slate" mono>k_a91c</Badge>
              <Badge tone="teal">admin</Badge>
              <Badge tone="amber">root</Badge>
              <Badge tone="slate" mono>v1.4.2</Badge>
            </div>
          </ComponentCard>

          <ComponentCard title="Inputs">
            <div className="col">
              <div className="field" style={{ margin: 0, marginBottom: 12 }}>
                <label>Default</label>
                <input className="input" placeholder="Type something…"/>
              </div>
              <div className="field" style={{ margin: 0, marginBottom: 12 }}>
                <label>Mono · for keys</label>
                <input className="input mono" defaultValue="checkout.new-cart"/>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Invalid</label>
                <input className="input" aria-invalid="true" defaultValue="not valid"/>
                <span className="err"><Icon name="alert" size={11}/> Must be lowercase.</span>
              </div>
            </div>
          </ComponentCard>

          <ComponentCard title="Checkbox">
            <div className="row" style={{ gap: 14 }}>
              <span className="row"><Checkbox checked={false} onChange={() => {}}/><span className="muted">unchecked</span></span>
              <span className="row"><Checkbox checked={true} onChange={() => {}}/><span className="muted">checked</span></span>
              <span className="row"><Checkbox indeterminate onChange={() => {}}/><span className="muted">indeterminate</span></span>
            </div>
          </ComponentCard>

          <ComponentCard title="Keyboard hints">
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', fontSize: 12.5 }}>
              <span>Open palette <Kbd>⌘</Kbd><Kbd>K</Kbd></span>
              <span>Filter <Kbd>/</Kbd></span>
              <span>New flag <Kbd>n</Kbd></span>
              <span>Help <Kbd>?</Kbd></span>
              <span>Go to flags <Kbd>g</Kbd><Kbd>f</Kbd></span>
            </div>
          </ComponentCard>

          <ComponentCard title="Override rule chip">
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              <span className="mono" style={{ fontSize: 13 }}>if</span>
              <Badge tone="slate" mono>cohort</Badge>
              <span className="muted">equals</span>
              <Badge tone="slate" mono>beta</Badge>
              <span className="mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>then return</span>
              <Badge tone="teal" dot>true</Badge>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>The DSL is just chips. No one has to learn a query language.</div>
          </ComponentCard>

          <ComponentCard title="Env scope chip group">
            <div className="env-chips">
              <button className="env-chip" data-env="development" aria-pressed="true"><span className="dot"/>development</button>
              <button className="env-chip" data-env="staging"><span className="dot"/>staging</button>
              <button className="env-chip" data-env="production"><span className="dot"/>production</button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Lives in the topbar. Setting it filters every page to that environment.</div>
          </ComponentCard>
        </div>
      </Section>

      <Section title="Iconography" icon="sparkles">
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12 }}>
            {['flag','layers','target','key','history','settings','plus','search','check','x','trash','edit','copy','eye','alert','info','keyboard','cmd','code','bolt','shield','refresh','sparkles','book','user','palette','play','arrowRight'].map((n) => (
              <div key={n} style={{ textAlign: 'center', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <Icon name={n} size={18}/>
                <div className="mono muted" style={{ fontSize: 10.5, marginTop: 6 }}>{n}</div>
              </div>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            All icons are 24×24 viewbox, 1.5px stroke, rounded joins. Hand-drawn for this prototype to keep the bundle tiny.
          </div>
        </div>
      </Section>

      <Section title="Inventory" icon="book">
        <div className="card" style={{ padding: 0 }}>
          <table className="flag-table">
            <thead>
              <tr><th>Screen</th><th>Status</th><th>Key interactions</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {[
                ['Flags list', 'covered', 'filter, bulk-select, per-env toggle, prod confirm', 'The page the team lives in. Designed for ops speed.'],
                ['Flag detail · Environments', 'covered', 'large toggles, override counts, latency hint', ''],
                ['Flag detail · Overrides', 'covered', 'env scope, rule list, builder modal', 'Rules are evaluated top-to-bottom.'],
                ['Flag detail · Usage', 'covered', 'eval counts, latency, true-rate, snippet', 'Numbers are mock — wired to /api/v1/admin once available.'],
                ['Flag detail · History', 'covered', 'per-flag timeline', ''],
                ['Create flag', 'covered', 'auto-slug key, tags, snippet preview', ''],
                ['Environments', 'covered', 'cards, protection toggle, slugs', ''],
                ['API keys', 'covered', 'list, issue, one-time reveal', 'Keys are SHA-256 hashed at rest.'],
                ['Audit log', 'covered', 'filter by actor & env, day grouping', ''],
                ['Onboarding', 'covered', '4-step flow with progress strip', 'Shown on first login per project.'],
                ['Degraded states', 'covered', 'inline cards + form validation', 'These appear contextually, not as a page.'],
                ['Settings', 'placeholder', '—', 'Out of scope for this brief.'],
              ].map((r, i) => (
                <tr key={i} style={{ cursor: 'default' }}>
                  <td><b>{r[0]}</b></td>
                  <td>{r[1] === 'covered' ? <Badge tone="teal" dot>covered</Badge> : <Badge tone="slate" dot>placeholder</Badge>}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{r[2]}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <Icon name={icon} size={16} className="muted"/>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 8 }}/>
      </div>
      {children}
    </section>
  );
}

function RationaleCard({ n, title, body }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'var(--pri-soft)', color: 'var(--pri-fg)',
          display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12,
          border: '1px solid var(--pri-soft-border)',
        }}>{n}</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{body}</div>
    </div>
  );
}

function ColorRamp({ label, prefix, tokens }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
        <span className="muted mono" style={{ fontSize: 11 }}>--{prefix}-*</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tokens.length}, 1fr)`, gap: 4 }}>
        {tokens.map((t) => (
          <div key={t}>
            <div style={{
              height: 48, borderRadius: 6,
              background: `var(--${prefix}-${t})`,
              border: '1px solid var(--border)',
            }}/>
            <div className="mono muted" style={{ fontSize: 10.5, marginTop: 4, textAlign: 'center' }}>{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SemanticRow({ label, var_, theme }) {
  // Use a small inline themed wrapper for dark
  const wrap = (
    <div className="row" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
      <div style={{ width: 22, height: 22, borderRadius: 5, background: `var(${var_})`, border: '1px solid var(--border)' }}/>
      <span className="mono" style={{ fontSize: 12 }}>{var_}</span>
      <span className="spacer"/>
      <span className="muted" style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
  return theme === 'dark' ? <div className="theme-dark" style={{ color: 'var(--text-1)' }}>{wrap}</div> : wrap;
}

function TypeRow({ size, weight, name, sample, font, upper, tracking }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 18, padding: '10px 0', borderBottom: '1px dashed var(--border)', alignItems: 'baseline' }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</div>
        <div className="mono muted" style={{ fontSize: 11 }}>{size}px / {weight} / {font === 'mono' ? 'JetBrains Mono' : 'Inter'}</div>
      </div>
      <div style={{
        fontSize: size, fontWeight: weight,
        fontFamily: font === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
        textTransform: upper ? 'uppercase' : 'none',
        letterSpacing: upper ? '0.06em' : tracking || 'normal',
      }}>{sample}</div>
    </div>
  );
}

function ComponentCard({ title, children }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

Object.assign(window, { DesignSystemScreen });
