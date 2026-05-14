/* global React, Icon, Button, Toggle, Badge, Modal, useToast, Tip, Kbd */
const { useState, useMemo, useEffect } = React;

// Stable mock — same (key,val) -> same count every time.
function ovrMatchCount(key, val) {
  if (!key || !val) return 0;
  let h = 5381;
  const s = key + '=' + val;
  for (let i = 0; i < s.length; i++) h = ((h * 33) + s.charCodeAt(i)) >>> 0;
  return (h % 4800) + 24;
}

const OPS_BY_TYPE = {
  string:  [['equals', 'equals'], ['in', 'in'], ['startsWith', 'starts with'], ['contains', 'contains'], ['regex', 'regex']],
  enum:    [['equals', 'equals'], ['in', 'in']],
  boolean: [['is', 'is']],
  number:  [['eq', '='], ['neq', '≠'], ['lt', '<'], ['lte', '≤'], ['gt', '>'], ['gte', '≥']],
  version: [['eq', '='], ['gte', '≥'], ['lte', '≤'], ['satisfies', 'satisfies']],
  date:    [['before', 'before'], ['after', 'after']],
};

const ENV_TONE = {
  development: 'teal',
  staging: 'amber',
  production: 'red',
};

// ============================================================
// Main section — lives in FlagDetail / Environments tab
// ============================================================
function ContextOverridesSection({ flag, defaults }) {
  const [env, setEnv] = useState('production');
  const [overrides, setOverrides] = useState(() =>
    (window.OVERRIDES || []).filter((o) => o.flag === flag.key)
  );
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();

  const envOverrides = useMemo(
    () => overrides.filter((o) => o.env === env),
    [overrides, env]
  );

  const envDefault = (defaults && defaults[env]?.on) ?? flag.state[env].on;

  function addOverride(payload) {
    const o = { id: 'ov_' + Math.random().toString(36).slice(2, 8), flag: flag.key, env, ...payload, created: '2026-05-13' };
    setOverrides((xs) => [...xs, o]);
    setAdding(false);
    toast.push({ title: 'Override saved', msg: `${payload.key} ${payload.op} ${payload.val} → ${payload.result ? 'on' : 'off'}` });
  }
  function updateOverride(id, payload) {
    setOverrides((xs) => xs.map((o) => o.id === id ? { ...o, ...payload } : o));
    setEditingId(null);
    toast.push({ title: 'Override updated' });
  }
  function deleteOverride(o) {
    setOverrides((xs) => xs.filter((x) => x.id !== o.id));
    toast.push({ title: 'Override deleted', msg: `${o.key} ${o.op} ${o.val}` });
  }

  return (
    <section className="ctx-ovr-section">
      <div className="ctx-ovr-head">
        <div>
          <h3>Context overrides</h3>
          <p className="sub">
            When a request matches a rule, the rule's result wins over the environment default.
            Rules are evaluated top-to-bottom; first match wins.
          </p>
        </div>
        <span className="spacer"/>
        <Button
          variant="primary"
          leftIcon="plus"
          onClick={() => { setAdding(true); setEditingId(null); }}
          disabled={adding}
        >Add override</Button>
      </div>

      <div className="ctx-ovr-envtabs" role="tablist" aria-label="Override environment">
        {window.ENVS.map((e) => {
          const n = overrides.filter((o) => o.env === e.slug).length;
          const on = (defaults && defaults[e.slug]?.on) ?? flag.state[e.slug].on;
          return (
            <button
              key={e.slug}
              role="tab"
              aria-pressed={env === e.slug}
              data-env={e.slug}
              className="ctx-ovr-envtab"
              onClick={() => setEnv(e.slug)}
            >
              <span className={'env-dot ' + ENV_TONE[e.slug]}/>
              <span className="env-name">{e.slug}</span>
              <span className="env-state mono">default {on ? 'on' : 'off'}</span>
              <span className="env-count num">{n}</span>
            </button>
          );
        })}
      </div>

      {envOverrides.length === 0 && !adding ? (
        <EmptyOverrides
          envSlug={env}
          defaultOn={envDefault}
          onAdd={() => setAdding(true)}
        />
      ) : (
        <div className="ctx-ovr-stack">
          {envOverrides.map((o, i) => (
            editingId === o.id ? (
              <OverrideForm
                key={o.id}
                initial={o}
                env={env}
                existing={envOverrides.filter((x) => x.id !== o.id)}
                onCancel={() => setEditingId(null)}
                onSave={(payload) => updateOverride(o.id, payload)}
              />
            ) : (
              <OverrideRow
                key={o.id}
                index={i}
                override={o}
                onEdit={() => { setEditingId(o.id); setAdding(false); }}
                onDelete={() => deleteOverride(o)}
              />
            )
          ))}
          {adding ? (
            <OverrideForm
              env={env}
              existing={envOverrides}
              onCancel={() => setAdding(false)}
              onSave={addOverride}
            />
          ) : null}
          {!adding && envOverrides.length > 0 ? (
            <button className="ctx-ovr-addrow" onClick={() => setAdding(true)}>
              <Icon name="plus" size={13}/>
              <span>Add another override</span>
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

// ============================================================
// Displayed override (read-only row)
// ============================================================
function OverrideRow({ index, override, onEdit, onDelete }) {
  const matches = ovrMatchCount(override.key, override.val);
  const field = (window.CONTEXT_FIELDS || []).find((f) => f.key === override.key);
  const opLabel = (OPS_BY_TYPE[field?.type] || OPS_BY_TYPE.string).find((o) => o[0] === override.op)?.[1] || override.op;
  return (
    <div className="ctx-ovr-row">
      <span className="ord mono">{String(index + 1).padStart(2, '0')}</span>
      <div className="rule">
        <span className="kw">if</span>
        <span className="ctx-key mono">{override.key}</span>
        <span className="op">{opLabel}</span>
        <span className="val mono">{override.val.includes(',') ? <span>{override.val}</span> : <>&ldquo;{override.val}&rdquo;</>}</span>
        <span className="kw arrow">→</span>
        <span className={'result ' + (override.result ? 'on' : 'off')}>
          <span className="dot"/>{override.result ? 'ON' : 'OFF'}
        </span>
      </div>
      <div className="meta">
        {override.note ? <span className="note" title={override.note}>{override.note}</span> : null}
        <Tip tip="Approximate match count from the last 7 days of evaluations">
          <span className="match mono">
            <Icon name="user" size={11}/>
            ~{matches.toLocaleString()} matched
          </span>
        </Tip>
      </div>
      <div className="actions">
        <Tip tip="Edit override"><button className="icon-btn" onClick={onEdit}><Icon name="edit" size={13}/></button></Tip>
        <Tip tip="Delete override"><button className="icon-btn danger" onClick={onDelete}><Icon name="trash" size={13}/></button></Tip>
      </div>
    </div>
  );
}

// ============================================================
// Inline add/edit form
// ============================================================
function OverrideForm({ initial, env, existing, onSave, onCancel }) {
  const fields = window.CONTEXT_FIELDS || [];
  const [key, setKey] = useState(initial?.key || fields[0]?.key || 'tenant');
  const [op, setOp] = useState(initial?.op || 'equals');
  const [val, setVal] = useState(initial?.val || '');
  const [result, setResult] = useState(initial ? initial.result : true);
  const [note, setNote] = useState(initial?.note || '');

  const field = fields.find((f) => f.key === key);
  const inRegistry = !!field;
  const ops = OPS_BY_TYPE[field?.type] || OPS_BY_TYPE.string;
  const opValid = ops.find((o) => o[0] === op) ? op : ops[0][0];

  // Validation hints
  const matches = ovrMatchCount(key, val);
  const duplicate = useMemo(
    () => existing.some((x) => x.key === key && x.op === opValid && x.val === val),
    [existing, key, opValid, val]
  );
  const sameKey = useMemo(
    () => existing.filter((x) => x.key === key && !(x.op === opValid && x.val === val)),
    [existing, key, opValid, val]
  );
  const conflict = sameKey.some((x) => x.val === val && x.result !== result);

  const canSave = val.trim() && !duplicate;

  return (
    <div className="ctx-ovr-form" data-mode={initial ? 'edit' : 'add'}>
      <div className="form-head">
        <span className="form-title">{initial ? 'Edit override' : 'New override'}</span>
        <span className="muted" style={{ fontSize: 11.5 }}>in <span className="mono" data-env={env}>{env}</span></span>
        <span className="spacer"/>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancel"><Icon name="x" size={13}/></button>
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label>When context key</label>
          <select className="select mono" value={key} onChange={(e) => { setKey(e.target.value); setVal(''); }}>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>{f.key}</option>
            ))}
            {!inRegistry ? <option value={key}>{key} (unregistered)</option> : null}
          </select>
          {field ? (
            <span className="form-hint">{field.type} · from {field.source}</span>
          ) : (
            <span className="form-hint warn"><Icon name="alert" size={11}/>Not in registry — rules won't match unless added</span>
          )}
        </div>

        <div className="form-field op-field">
          <label>matches</label>
          <select className="select" value={opValid} onChange={(e) => setOp(e.target.value)}>
            {ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="form-field val-field">
          <label>value</label>
          {field?.type === 'enum' ? (
            <select className="select mono" value={val} onChange={(e) => setVal(e.target.value)}>
              <option value="">Select…</option>
              {(field.enumValues || []).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ) : field?.type === 'boolean' ? (
            <select className="select mono" value={val} onChange={(e) => setVal(e.target.value)}>
              <option value="">Select…</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              className="input mono"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={opValid === 'in' ? 'samsung, verizon, att' : (field?.example || 'samsung')}
              autoFocus
            />
          )}
        </div>

        <div className="form-field result-field">
          <label>then return</label>
          <div className="result-seg" role="radiogroup" aria-label="Override result">
            <button
              role="radio"
              aria-checked={result === true}
              className={'result-pill on' + (result === true ? ' selected' : '')}
              onClick={() => setResult(true)}
            >
              <span className="dot"/>ON
            </button>
            <button
              role="radio"
              aria-checked={result === false}
              className={'result-pill off' + (result === false ? ' selected' : '')}
              onClick={() => setResult(false)}
            >
              <span className="dot"/>OFF
            </button>
          </div>
        </div>
      </div>

      <div className="form-field full">
        <label>Note <span className="muted" style={{ fontSize: 11 }}>· optional</span></label>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why this rule? Helps the next on-call."
        />
      </div>

      {/* Inline validation messages */}
      <div className="form-hints">
        {duplicate ? (
          <div className="form-msg warn">
            <Icon name="alert" size={12}/>
            <span>Identical rule already exists — saving is disabled.</span>
          </div>
        ) : null}
        {conflict ? (
          <div className="form-msg warn">
            <Icon name="alert" size={12}/>
            <span>Another rule for <span className="mono">{key}={val}</span> returns the opposite result. The earlier one will win.</span>
          </div>
        ) : null}
        {!inRegistry ? (
          <div className="form-msg warn">
            <Icon name="alert" size={12}/>
            <span>
              <span className="mono">{key}</span> isn't a registered context field. The SDK will drop unknown keys silently —{' '}
              <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--pri-fg)' }}>add it in Project settings →</a>
            </span>
          </div>
        ) : null}
        {val.trim() && !duplicate ? (
          <div className="form-msg info">
            <Icon name="info" size={12}/>
            <span>
              <b className="num">~{matches.toLocaleString()}</b> users currently match this rule —
              they'll see <span className={'inline-state ' + (result ? 'on' : 'off')}>{result ? 'ON' : 'OFF'}</span>
              {' '}in <span className="mono">{env}</span>.
            </span>
          </div>
        ) : null}
      </div>

      <div className="form-actions">
        <span className="muted" style={{ fontSize: 11.5 }}>
          Changes are live — no confirm step
        </span>
        <span className="spacer"/>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!canSave}
          onClick={() => onSave({ key, op: opValid, val, result, note })}
        >
          {initial ? 'Save changes' : 'Save override'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Empty state
// ============================================================
function EmptyOverrides({ envSlug, defaultOn, onAdd }) {
  return (
    <div className="ctx-ovr-empty">
      <div className="ill" aria-hidden="true">
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none">
          <circle cx="34" cy="34" r="26" fill="var(--bg-subtle)" stroke="var(--border)"/>
          <circle cx="34" cy="34" r="16" fill="var(--bg-elev)" stroke="var(--border-strong)"/>
          <circle cx="34" cy="34" r="6" fill="var(--pri-soft)" stroke="var(--pri)"/>
          <circle cx="34" cy="34" r="2" fill="var(--pri)"/>
        </svg>
      </div>
      <h3>No overrides in <span className="mono">{envSlug}</span></h3>
      <p>
        Every caller in this environment gets the default —{' '}
        <span className={'inline-state ' + (defaultOn ? 'on' : 'off')}>{defaultOn ? 'ON' : 'OFF'}</span>.
        Add an override to flip the result for a specific tenant, user, or segment.
      </p>
      <div className="row" style={{ gap: 8, marginTop: 4 }}>
        <Button variant="primary" leftIcon="plus" onClick={onAdd}>Add your first override</Button>
        <Button variant="ghost" leftIcon="book">See examples</Button>
      </div>
    </div>
  );
}

Object.assign(window, { ContextOverridesSection });
