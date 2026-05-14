/* global React */
const { useState, useEffect, useRef, useCallback } = React;

// ---------- Icons (outline, 1.5px stroke, rounded joins) ----------
function Icon({ name, size = 16, className = '', ...rest }) {
  const s = size;
  const props = {
    width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', className, ...rest,
  };
  const P = {
    flag: <><path d="M5 21V4"/><path d="M5 4h11l-1.5 3.5L16 11H5"/></>,
    flagFilled: <><path d="M5 21V4"/><path d="M5 4h11l-1.5 3.5L16 11H5z" fill="currentColor"/></>,
    layers: <><path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 18l9 5 9-5"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></>,
    key: <><path d="M14 9.5a5 5 0 1 0-5 5L10 16l2 2 1-1 1 1 2-2-1-1 1-1-1-1 1-1-1-1"/><circle cx="14" cy="9.5" r="1.2" fill="currentColor"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8L4.2 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    chevronRight: <><path d="m9 6 6 6-6 6"/></>,
    check: <><path d="m5 12 5 5L20 7"/></>,
    minus: <><path d="M5 12h14"/></>,
    x: <><path d="M6 6l12 12M18 6 6 18"/></>,
    moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    alert: <><path d="M12 9v4M12 17h.01"/><path d="m10.3 3.9-8 13.5A2 2 0 0 0 4 20.4h16a2 2 0 0 0 1.7-3l-8-13.5a2 2 0 0 0-3.4 0z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></>,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    edit: <><path d="M11 4H4v16h16v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="M9.9 5a8.6 8.6 0 0 1 2.1-.3c6 0 10 7 10 7a16 16 0 0 1-2.4 3.2M6.6 6.6A16 16 0 0 0 2 12s4 7 10 7a8.6 8.6 0 0 0 4.5-1.3"/><path d="m9.9 9.9 4.2 4.2"/><path d="M2 2l20 20"/></>,
    filter: <><path d="M3 5h18M6 12h12M10 19h4"/></>,
    keyboard: <><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/></>,
    cmd: <><path d="M15 9V6a3 3 0 1 1 3 3h-3zM15 9v6M15 15h3a3 3 0 1 1-3 3v-3zM15 15H9M9 15v3a3 3 0 1 1-3-3h3zM9 15V9M9 9H6a3 3 0 1 1 3-3v3z"/></>,
    code: <><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></>,
    bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    check2: <><path d="m5 12 5 5L20 7"/></>,
    chevDouble: <><path d="m11 17 5-5-5-5M6 17l5-5-5-5"/></>,
    book: <><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 16a4 4 0 0 1 4-4h12"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15.7-6L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.7 6L3 16M3 21v-5h5"/></>,
    wifiOff: <><path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5.2-2.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 12 5c-.8 0-1.6.1-2.3.2"/><circle cx="12" cy="20" r=".8" fill="currentColor"/></>,
    sparkles: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    play: <><path d="M6 4v16l14-8z"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    palette: <><path d="M12 22a10 10 0 1 1 10-10c0 2-1.6 3-3.5 3H17a2 2 0 0 0-1.8 2.8 2 2 0 0 1-1.8 2.8c-.5.1-1 .2-1.4.4"/><circle cx="7.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="12" cy="6.5" r="1.2" fill="currentColor"/><circle cx="16.5" cy="9.5" r="1.2" fill="currentColor"/></>,
  };
  return (
    <svg {...props}>{P[name] || P.flag}</svg>
  );
}

// ---------- Button ----------
function Button({ children, variant = 'default', size, leftIcon, rightIcon, className = '', ...rest }) {
  const cls = ['btn', variant !== 'default' && variant, size, className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {leftIcon ? <Icon name={leftIcon} size={14}/> : null}
      {children}
      {rightIcon ? <Icon name={rightIcon} size={14}/> : null}
    </button>
  );
}

// ---------- Kbd ----------
function Kbd({ children }) { return <kbd className="kbd">{children}</kbd>; }
function KbdHint({ keys }) {
  return (
    <span className="kbd-hint">
      {keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
    </span>
  );
}

// ---------- Toggle ----------
function Toggle({ checked, onChange, size, production, ariaLabel, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || 'Toggle'}
      disabled={disabled}
      className={['toggle', size, production ? 'production' : ''].filter(Boolean).join(' ')}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    />
  );
}

// ---------- Checkbox ----------
function Checkbox({ checked, onChange, indeterminate, ariaLabel }) {
  const state = indeterminate ? 'mixed' : checked ? 'true' : 'false';
  return (
    <button
      role="checkbox"
      aria-checked={state}
      aria-label={ariaLabel || 'Select'}
      className="check"
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    >
      <Icon name={indeterminate ? 'minus' : 'check'} size={11}/>
    </button>
  );
}

// ---------- Badge ----------
function Badge({ tone = 'slate', mono, dot, children }) {
  return (
    <span className={['badge', tone, mono ? 'mono' : ''].filter(Boolean).join(' ')}>
      {dot ? <span className="dot"/> : null}
      {children}
    </span>
  );
}

// ---------- Modal ----------
function Modal({ open, onClose, children, size, className = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={['modal', size, className].filter(Boolean).join(' ')} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

// ---------- Toasts ----------
let _toastId = 0;
const ToastCtx = React.createContext({ push: () => {} });
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((t) => {
    const id = ++_toastId;
    setToasts((xs) => [...xs, { id, ...t }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + (t.kind || 'success')}>
            <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} size={18} className="ico"/>
            <div>
              <div className="title">{t.title}</div>
              {t.msg ? <div className="msg">{t.msg}</div> : null}
            </div>
            <button className="icon-btn" onClick={() => setToasts((xs) => xs.filter((x) => x.id !== t.id))}><Icon name="x" size={14}/></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
function useToast() { return React.useContext(ToastCtx); }

// ---------- Tooltip ----------
function Tip({ tip, children }) { return <span className="tt" data-tt={tip}>{children}</span>; }

// ---------- Tags row ----------
function TagRow({ tags }) {
  return (
    <span className="tag-row">
      {tags.map((t) => <Badge key={t} tone="slate">{t}</Badge>)}
    </span>
  );
}

// ---------- Annotation dot ----------
function Anno({ n, top, left, right, bottom }) {
  return <span className="anno-dot" style={{ top, left, right, bottom }}>{n}</span>;
}

// ---------- Section header ----------
function PageHeader({ title, sub, actions, breadcrumb }) {
  return (
    <div className="page-header">
      <div style={{ flex: 1, minWidth: 0 }}>
        {breadcrumb ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12, marginBottom: 6 }}>
            {breadcrumb.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <Icon name="chevronRight" size={12}/> : null}
                <span>{b}</span>
              </React.Fragment>
            ))}
          </div>
        ) : null}
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

Object.assign(window, {
  Icon, Button, Kbd, KbdHint, Toggle, Checkbox, Badge, Modal,
  ToastProvider, useToast, Tip, TagRow, Anno, PageHeader,
});
