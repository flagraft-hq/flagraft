/* global React, Icon, Button, Toggle, Badge, Checkbox, Modal, Tip, Kbd, PageHeader, useToast */
/*
  Users screen — workspace-wide user directory.
  Design reference extracted from the Flagraft admin prototype.

  Depends on these shared primitives (substitute your codebase's equivalents):
    Icon, Button, Badge, Checkbox, Modal, Tip, PageHeader, useToast
  and the CSS in users-styles.css (tokens like --pri, --bg-elev live in the
  base design system).
*/
const { useState, useMemo, useEffect } = React;

// ============================================================
// SCREEN: Users (workspace-wide directory)
// Differs from "Members" in Settings — that's per-project.
// This is workspace-level: every human + service account, across projects.
// ============================================================
const USERS = [
  { id: 'u_001', name: 'Kochar S.',     email: 'kochar@kocharsoft.com', role: 'owner',  status: 'active',  twoFA: 'app',  last: '2 min ago',  projects: ['Checkout Web', 'Mobile API', 'Internal Tools'], joined: '2025-09-01', initials: 'KS', tone: 'amber' },
  { id: 'u_002', name: 'Aida Roussel',  email: 'aida@kocharsoft.com',   role: 'admin',  status: 'active',  twoFA: 'app',  last: '12 min ago', projects: ['Checkout Web', 'Mobile API'], joined: '2025-10-14', initials: 'AR', tone: 'teal' },
  { id: 'u_003', name: 'Marin Pé',      email: 'marin@kocharsoft.com',  role: 'admin',  status: 'active',  twoFA: 'key',  last: '3 hr ago',   projects: ['Checkout Web'], joined: '2025-11-08', initials: 'MP', tone: 'violet' },
  { id: 'u_004', name: 'Devon Tate',    email: 'devon@kocharsoft.com',  role: 'editor', status: 'active',  twoFA: 'app',  last: 'yesterday',  projects: ['Checkout Web', 'Internal Tools'], joined: '2026-01-22', initials: 'DT', tone: 'teal' },
  { id: 'u_005', name: 'Sasha Lin',     email: 'sasha@kocharsoft.com',  role: 'viewer', status: 'active',  twoFA: 'sms',  last: 'Apr 28',     projects: ['Internal Tools'], joined: '2026-02-12', initials: 'SL', tone: 'slate' },
  { id: 'u_006', name: 'Hugo Yamada',   email: 'hugo@kocharsoft.com',   role: 'editor', status: 'active',  twoFA: 'none', last: 'May 02',     projects: ['Mobile API'], joined: '2026-03-04', initials: 'HY', tone: 'amber' },
  { id: 'u_007', name: 'Priya Nair',    email: 'priya@kocharsoft.com',  role: 'viewer', status: 'active',  twoFA: 'app',  last: '5 min ago',  projects: ['Checkout Web'], joined: '2026-03-19', initials: 'PN', tone: 'violet' },
  { id: 'u_008', name: 'Erik Brandt',   email: 'erik@kocharsoft.com',   role: 'admin',  status: 'suspended', twoFA: 'app', last: 'Mar 11',  projects: ['Mobile API'], joined: '2025-12-01', initials: 'EB', tone: 'slate' },
  { id: 'u_009', name: 'Lina Acosta',   email: 'lina@contractor.io',    role: 'editor', status: 'invited', twoFA: 'none', last: 'never',     projects: ['Checkout Web'], joined: 'Pending', initials: 'LA', tone: 'slate' },
  { id: 'u_010', name: 'Tomás Vrána',   email: 'tomas@contractor.io',   role: 'viewer', status: 'invited', twoFA: 'none', last: 'never',     projects: ['Internal Tools'], joined: 'Pending', initials: 'TV', tone: 'slate' },
  { id: 'u_011', name: 'CI Bot',        email: 'ci@kocharsoft.com',     role: 'editor', status: 'active',  twoFA: 'key',  last: '24s ago',    projects: ['Checkout Web', 'Mobile API', 'Internal Tools'], joined: '2025-11-30', initials: 'CB', tone: 'slate', system: true },
  { id: 'u_012', name: 'Release Bot',   email: 'release@kocharsoft.com',role: 'admin',  status: 'active',  twoFA: 'key',  last: '8 min ago',  projects: ['Checkout Web'], joined: '2026-02-01', initials: 'RB', tone: 'slate', system: true },
];

function UsersScreen() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | invited | suspended | system
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState({ key: 'last', dir: 'desc' });
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null); // user object
  const [showInvite, setShowInvite] = useState(false);

  const counts = useMemo(() => {
    const c = { all: USERS.length, active: 0, invited: 0, suspended: 0, system: 0 };
    USERS.forEach((u) => {
      if (u.system) c.system++;
      else c[u.status]++;
    });
    return c;
  }, []);

  const filtered = useMemo(() => {
    const Q = q.trim().toLowerCase();
    let xs = USERS.filter((u) => {
      if (statusFilter === 'system') { if (!u.system) return false; }
      else if (statusFilter !== 'all') { if (u.system) return false; if (u.status !== statusFilter) return false; }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (Q && !(u.name + ' ' + u.email + ' ' + u.projects.join(' ')).toLowerCase().includes(Q)) return false;
      return true;
    });
    const ord = sortBy.dir === 'asc' ? 1 : -1;
    xs.sort((a, b) => {
      if (sortBy.key === 'name') return a.name.localeCompare(b.name) * ord;
      if (sortBy.key === 'role') {
        const order = { owner: 0, admin: 1, editor: 2, viewer: 3 };
        return (order[a.role] - order[b.role]) * ord;
      }
      if (sortBy.key === 'projects') return (a.projects.length - b.projects.length) * ord;
      if (sortBy.key === 'last') {
        // crude: order by status active first then by string
        const ax = a.last === 'never' ? 'zzz' : a.last;
        const bx = b.last === 'never' ? 'zzz' : b.last;
        return ax.localeCompare(bx) * ord;
      }
      return 0;
    });
    return xs;
  }, [q, statusFilter, roleFilter, sortBy]);

  const allChecked = filtered.length > 0 && filtered.every((u) => selected.has(u.id));
  const someChecked = filtered.some((u) => selected.has(u.id)) && !allChecked;
  const toggleAll = () => {
    const ns = new Set(selected);
    if (allChecked) { filtered.forEach((u) => ns.delete(u.id)); }
    else { filtered.forEach((u) => ns.add(u.id)); }
    setSelected(ns);
  };
  const toggleOne = (id) => {
    const ns = new Set(selected);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setSelected(ns);
  };

  const sortHead = (key, label, align) => (
    <button className={'sort-head' + (align === 'right' ? ' right' : '')} onClick={() => setSortBy((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
      <span>{label}</span>
      <span className={'sort-arrow' + (sortBy.key === key ? ' on' : '')}>
        <Icon name="chevronDown" size={11} style={{ transform: sortBy.key === key && sortBy.dir === 'asc' ? 'rotate(180deg)' : 'none' }}/>
      </span>
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Users"
        sub={<>Everyone with access to this workspace — across all projects. Project-specific access lives under <a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>Project settings → Members</a>.</>}
        actions={
          <>
            <Button variant="ghost" leftIcon="code">Export CSV</Button>
            <Button variant="primary" leftIcon="plus" onClick={() => setShowInvite(true)}>Invite user</Button>
          </>
        }
      />

      {/* Stat strip */}
      <div className="users-stats">
        <StatCard label="Total users"  value={counts.all} sub={<>{counts.active} active · {counts.system} service</>} icon="user" tone="teal"/>
        <StatCard label="Pending invites" value={counts.invited} sub={counts.invited > 0 ? <>Expires in <b>7&nbsp;days</b></> : 'Nothing pending'} icon="sparkles" tone="amber" warn={counts.invited > 0}/>
        <StatCard label="2FA enforced" value={Math.round((USERS.filter((u) => u.twoFA !== 'none' && !u.system).length / USERS.filter((u) => !u.system).length) * 100) + '%'} sub={<>{USERS.filter((u) => u.twoFA === 'none' && !u.system).length} without 2FA</>} icon="shield" tone="teal"/>
        <StatCard label="Seats" value={<>{USERS.length}<span className="unit">/25</span></>} sub={<>{25 - USERS.length} remaining</>} icon="layers" tone="slate"/>
      </div>

      {/* Filter bar */}
      <div className="users-toolbar">
        <div className="users-search">
          <Icon name="search" size={14} className="ic"/>
          <input
            placeholder="Search by name, email, project…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q ? <button className="users-search-clear" onClick={() => setQ('')} aria-label="Clear"><Icon name="x" size={12}/></button> : null}
        </div>

        <div className="chip-group" role="tablist" aria-label="Status filter">
          {[
            { id: 'all',      label: 'All',       n: counts.all },
            { id: 'active',   label: 'Active',    n: counts.active },
            { id: 'invited',  label: 'Invited',   n: counts.invited, tone: 'amber' },
            { id: 'suspended',label: 'Suspended', n: counts.suspended, tone: 'red' },
            { id: 'system',   label: 'Service',   n: counts.system },
          ].map((c) => (
            <button
              key={c.id}
              className="chip"
              aria-pressed={statusFilter === c.id}
              data-tone={c.tone}
              onClick={() => setStatusFilter(c.id)}
            >
              <span>{c.label}</span>
              <span className="chip-n num">{c.n}</span>
            </button>
          ))}
        </div>

        <span className="spacer"/>

        <select className="select" style={{ height: 32, width: 'auto' }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="editor">editor</option>
          <option value="viewer">viewer</option>
        </select>
      </div>

      {/* Table */}
      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th className="col-check">
                <Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} ariaLabel="Select all"/>
              </th>
              <th>{sortHead('name', 'Person')}</th>
              <th>{sortHead('role', 'Role')}</th>
              <th>{sortHead('projects', 'Project access')}</th>
              <th>2FA</th>
              <th>{sortHead('last', 'Last active')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-filtered">
                  <div className="ill"><Icon name="user" size={28} style={{ color: 'var(--text-3)' }}/></div>
                  <h3>No users match</h3>
                  <p>Try clearing the search or changing the status filter.</p>
                  <Button variant="ghost" onClick={() => { setQ(''); setStatusFilter('all'); setRoleFilter('all'); }}>Reset filters</Button>
                </div>
              </td></tr>
            ) : filtered.map((u) => (
              <tr
                key={u.id}
                className={'users-row' + (selected.has(u.id) ? ' selected' : '') + (u.status === 'suspended' ? ' suspended' : '') + (u.status === 'invited' ? ' invited' : '')}
                data-active={detail?.id === u.id ? 'true' : undefined}
                onClick={() => setDetail(u)}
              >
                <td className="col-check" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} ariaLabel={'Select ' + u.name}/>
                </td>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <span className={'avatar sm color-' + u.tone}>{u.initials}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="users-name">
                        {u.name}
                        {u.system ? <span style={{ marginLeft: 6 }}><Badge tone="slate"><Icon name="bolt" size={9}/> service</Badge></span> : null}
                        {u.status === 'invited' ? <span style={{ marginLeft: 6 }}><Badge tone="amber" dot>invited</Badge></span> : null}
                        {u.status === 'suspended' ? <span style={{ marginLeft: 6 }}><Badge tone="red" dot>suspended</Badge></span> : null}
                      </div>
                      <div className="users-email mono">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td><RoleBadge role={u.role}/></td>
                <td>
                  <div className="users-projects">
                    {u.projects.slice(0, 2).map((p) => (
                      <span key={p} className="proj-chip">{p}</span>
                    ))}
                    {u.projects.length > 2 ? <span className="proj-more">+{u.projects.length - 2}</span> : null}
                  </div>
                </td>
                <td><TwoFA value={u.twoFA}/></td>
                <td>
                  <span className={'users-last mono' + (u.last === 'never' ? ' never' : '')}>{u.last}</span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row" style={{ gap: 2 }}>
                    {u.status === 'invited' ? (
                      <>
                        <Tip tip="Resend invite"><button className="icon-btn" onClick={() => toast.push({ title: 'Invite resent', msg: u.email })}><Icon name="refresh" size={13}/></button></Tip>
                        <Tip tip="Cancel invite"><button className="icon-btn danger"><Icon name="x" size={13}/></button></Tip>
                      </>
                    ) : (
                      <>
                        <Tip tip="Edit user"><button className="icon-btn" onClick={() => setDetail(u)}><Icon name="edit" size={13}/></button></Tip>
                        <Tip tip={u.role === 'owner' ? 'Transfer ownership first' : (u.status === 'suspended' ? 'Reinstate' : 'Suspend')}>
                          <button className="icon-btn" disabled={u.role === 'owner'}>
                            <Icon name={u.status === 'suspended' ? 'check' : 'minus'} size={13}/>
                          </button>
                        </Tip>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="users-table-foot">
          <span className="muted" style={{ fontSize: 12 }}>{filtered.length} of {USERS.length} users</span>
          <span className="spacer"/>
          <span className="muted" style={{ fontSize: 12 }}>Provisioning via <span className="mono" style={{ color: 'var(--text-2)' }}>SCIM 2.0</span> · Okta</span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 ? (
        <div className="bulk-bar">
          <span className="bulk-count"><span className="num">{selected.size}</span> selected</span>
          <span className="bulk-sep"/>
          <span className="bulk-section-label">Role</span>
          <Button size="sm">Change role…</Button>
          <span className="bulk-sep"/>
          <span className="bulk-section-label">Access</span>
          <Button size="sm" leftIcon="layers">Add to project</Button>
          <Button size="sm" leftIcon="shield">Require 2FA</Button>
          <span className="bulk-sep"/>
          <Button size="sm" variant="danger">Suspend</Button>
          <button className="bulk-close" onClick={() => setSelected(new Set())} aria-label="Clear selection"><Icon name="x" size={14}/></button>
        </div>
      ) : null}

      {/* Detail drawer */}
      {detail ? <UserDetailDrawer user={detail} onClose={() => setDetail(null)} onAction={(k) => { toast.push({ title: k + ' · ' + detail.name }); }}/> : null}

      {/* Invite modal */}
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} onSend={() => { setShowInvite(false); toast.push({ title: 'Invites sent', msg: '2 emails dispatched.' }); }}/>
    </div>
  );
}

function StatCard({ label, value, sub, icon, tone, warn }) {
  return (
    <div className={'users-stat' + (warn ? ' warn' : '')} data-tone={tone}>
      <div className="users-stat-ic"><Icon name={icon} size={14}/></div>
      <div className="users-stat-body">
        <div className="users-stat-lbl">{label}</div>
        <div className="users-stat-val num">{value}</div>
        <div className="users-stat-sub">{sub}</div>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const tone = role === 'owner' ? 'amber' : role === 'admin' ? 'teal' : 'slate';
  return <Badge tone={tone} dot>{role}</Badge>;
}

function TwoFA({ value }) {
  if (value === 'none') return <span className="twofa none"><Icon name="alert" size={11}/> none</span>;
  const icons = { app: 'shield', key: 'key', sms: 'info' };
  const labels = { app: 'authenticator', key: 'security key', sms: 'sms' };
  return <span className="twofa ok"><Icon name={icons[value]} size={11}/> {labels[value]}</span>;
}

function UserDetailDrawer({ user, onClose, onAction }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="user-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={'User detail: ' + user.name}>
        <div className="user-drawer-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={16}/></button>
          <span className="spacer"/>
          <Tip tip="Copy user ID"><button className="icon-btn"><Icon name="copy" size={14}/></button></Tip>
          <Tip tip="Open audit"><button className="icon-btn"><Icon name="history" size={14}/></button></Tip>
        </div>

        <div className="user-drawer-hero">
          <span className={'avatar lg color-' + user.tone}>{user.initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{user.name}</h2>
            <div className="user-drawer-email mono">{user.email}</div>
            <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <RoleBadge role={user.role}/>
              {user.status === 'active' ? <Badge tone="teal" dot>active</Badge>
                : user.status === 'invited' ? <Badge tone="amber" dot>invited</Badge>
                : <Badge tone="red" dot>suspended</Badge>}
              {user.system ? <Badge tone="slate"><Icon name="bolt" size={9}/> service</Badge> : null}
            </div>
          </div>
        </div>

        <div className="user-drawer-body">
          <Section title="Details">
            <DRow label="User ID"     value={<span className="mono">{user.id}</span>}/>
            <DRow label="Joined"      value={<span className="mono">{user.joined}</span>}/>
            <DRow label="Last active" value={<span className="mono">{user.last}</span>}/>
            <DRow label="2FA"         value={<TwoFA value={user.twoFA}/>}/>
            <DRow label="Source"      value={user.system ? <span className="mono">service-account</span> : <span className="mono">scim · okta</span>}/>
          </Section>

          <Section title={'Project access · ' + user.projects.length}>
            <div className="user-projects">
              {user.projects.map((p) => (
                <div key={p} className="user-project">
                  <span className="proj-avatar" style={{ width: 28, height: 28, fontSize: 11, borderRadius: 8 }}>{p.split(' ').map((w) => w[0]).slice(0,2).join('')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>{user.role}</div>
                  </div>
                  <Tip tip="Remove from project"><button className="icon-btn"><Icon name="x" size={12}/></button></Tip>
                </div>
              ))}
              <button className="user-add-project">
                <Icon name="plus" size={12}/> Add to project
              </button>
            </div>
          </Section>

          <Section title="Recent activity">
            <ul className="user-activity">
              <li><span className="when mono">12 min ago</span><span>Enabled <span className="mono">checkout.apple-pay</span> in <span className="mono">staging</span></span></li>
              <li><span className="when mono">3 hr ago</span><span>Added override <span className="mono">cohort=beta</span> on <span className="mono">checkout.new-cart</span></span></li>
              <li><span className="when mono">Yesterday</span><span>Issued admin key <span className="mono">ff_ad_2f10</span></span></li>
              <li><span className="when mono">May 09</span><span>Signed in from <span className="mono">203.0.113.42</span> · Berlin</span></li>
            </ul>
          </Section>
        </div>

        <div className="user-drawer-foot">
          <Button variant="ghost" leftIcon="refresh" onClick={() => onAction('Password reset link sent')}>Reset password</Button>
          <Button variant="ghost" leftIcon="shield" onClick={() => onAction('2FA reset')}>Reset 2FA</Button>
          <span className="spacer"/>
          {user.status === 'suspended'
            ? <Button variant="primary" leftIcon="check" onClick={() => onAction('Reinstated')}>Reinstate</Button>
            : <Button variant="danger" leftIcon="minus" disabled={user.role === 'owner'} onClick={() => onAction('Suspended')}>Suspend</Button>}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="user-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function DRow({ label, value }) {
  return (
    <div className="user-drow">
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
    </div>
  );
}

function InviteModal({ open, onClose, onSend }) {
  const [emails, setEmails] = useState('lina@contractor.io, tomas@contractor.io');
  const [role, setRole] = useState('editor');
  const [projects, setProjects] = useState(new Set(['Checkout Web']));
  const toggleProject = (p) => {
    const ns = new Set(projects); if (ns.has(p)) ns.delete(p); else ns.add(p);
    setProjects(ns);
  };
  const parsed = emails.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="modal-header">
        <h2>Invite users</h2>
        <div className="sub">Invites expire after <b>7 days</b>. Recipients must verify their email and configure 2FA before they can sign in.</div>
      </div>
      <div className="modal-body">
        <div className="field">
          <label>Email addresses</label>
          <textarea
            className="input textarea mono"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="alex@company.com, jamie@company.com"
            style={{ minHeight: 76 }}
          />
          <div className="hint">Comma- or newline-separated. {parsed.length} {parsed.length === 1 ? 'recipient' : 'recipients'} parsed.</div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Workspace role</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
            <span className="hint">{role === 'admin' ? 'Can manage flags & keys in granted projects.' : role === 'editor' ? 'Can edit flags in dev/staging. Prod requires admin.' : 'Read-only across granted projects.'}</span>
          </div>
          <div className="field">
            <label>Default 2FA</label>
            <select className="select" defaultValue="required"><option value="required">Required</option><option value="optional">Optional</option></select>
            <span className="hint">Workspace policy enforces 2FA.</span>
          </div>
        </div>

        <div className="field">
          <label>Project access</label>
          <div className="invite-projects">
            {['Checkout Web', 'Mobile API', 'Internal Tools'].map((p) => (
              <button key={p} type="button" className="invite-proj-chip" aria-pressed={projects.has(p)} onClick={() => toggleProject(p)}>
                <span className="proj-avatar" style={{ width: 22, height: 22, fontSize: 9.5, borderRadius: 6 }}>{p.split(' ').map((w) => w[0]).slice(0,2).join('')}</span>
                <span>{p}</span>
                {projects.has(p) ? <Icon name="check" size={11}/> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="form-msg info">
          <Icon name="info" size={13}/>
          <div>
            Invitees receive a one-time link. Their account is created on first sign-in. SAML SSO users (matching <span className="mono">@kocharsoft.com</span>) skip the password step.
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <span className="spacer"/>
        <Button variant="primary" leftIcon="arrowRight" disabled={parsed.length === 0 || projects.size === 0} onClick={onSend}>Send {parsed.length || ''} {parsed.length === 1 ? 'invite' : 'invites'}</Button>
      </div>
    </Modal>
  );
}

Object.assign(window, { UsersScreen });
