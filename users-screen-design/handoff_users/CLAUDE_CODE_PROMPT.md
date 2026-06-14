> Paste this to Claude Code. The two reference files (`screens-users.jsx`,
> `users-styles.css`) are design references — recreate the screen in our
> codebase's stack and component library, don't copy the prototype verbatim.

---

Implement a **Users** management screen from the attached design reference (`screens-users.jsx` + `users-styles.css`). These files are a high-fidelity prototype (React-in-Babel + plain CSS) showing the intended look and behavior — recreate the screen in our existing stack using our component library and styling system, not by copying the prototype's ad-hoc primitives.

## What it is

A **workspace-wide** user directory — every human and service account that can access the workspace, across all projects. This is distinct from any per-project "Members" view; keep them separate.

## Layout (top to bottom)

1. **Page header** — title "Users", a subtitle, and right-aligned actions: a ghost "Export CSV" and a primary "Invite user" (opens the invite modal).
2. **Stat strip** — 4 equal cards (`repeat(4,1fr)`, collapses to 2 cols under ~1100px), each a 32px tinted icon + label/value/sub:
   - Total users (12) · "10 active · 2 service"
   - Pending invites (2, amber accent) · "Expires in 7 days"
   - 2FA enforced (computed %) · "N without 2FA"
   - Seats (12/25) · "13 remaining"
3. **Toolbar** — search input (filters name/email/projects), a single-select status chip group (All / Active / Invited[amber] / Suspended[red] / Service), and a role `<select>` pushed to the right.
4. **Table** — columns: select checkbox, Person (avatar + name + status badges + mono email), Role (colored-dot badge: owner=amber, admin=teal, editor/viewer=slate), Project access (≤2 chips + "+N"), 2FA (pill; "none" = amber warning), Last active (mono), row actions. Person/Role/Project/Last-active headers are sortable (chevron flips on asc; active key tinted). Footer strip shows "{n} of {total}" + a provisioning note.
5. **Bulk action bar** — floating pill, appears only when rows are selected: count, change-role, add-to-project, require-2FA, suspend (danger), and a clear button.
6. **Detail drawer** — right-anchored 480px panel, opens on row click, slides in. Hero (large avatar, name, mono email, role+status badges) over a scrollable body: Details (definition rows), Project access (cards + "Add to project"), Recent activity (timestamped list). Footer: Reset password, Reset 2FA, and Suspend/Reinstate (disabled for owner). Esc closes.
7. **Invite modal** — emails textarea (comma/whitespace-split, live-parsed count), workspace-role + default-2FA selects, project-access chip multi-select, an info note, and a "Send N invites" primary (disabled if 0 emails or 0 projects). On send: close + success toast.

## State

```
q, statusFilter, roleFilter, sortBy {key,dir}, selected:Set<id>, detail:User|null, showInvite:boolean
```

Derive `counts` (per status), `filtered` (filter+sort pipeline), and select-all `allChecked`/`someChecked`.

Status filter detail: selecting **Service** restricts to service accounts only; the other status filters exclude service accounts.

## Row states

hover (muted bg) · selected (teal-soft bg) · drawer-active (teal-soft + inset 3px left bar) · invited (subtle amber left fade) · suspended (name/email dimmed to 0.6).

## Data layer

The prototype uses a static `USERS` array — replace with our admin API. The `User` shape is documented at the top of the component (id, name, email, role, status, twoFA, last, projects[], joined, initials, tone, system?). Suggested endpoints:

- `GET /admin/users`, `GET /admin/users/:id`
- `POST /admin/users/invite` `{ emails[], role, projects[] }`
- `PATCH /admin/users/:id` (role / suspend / reinstate)
- `POST /admin/users/:id/reset-password`, `.../reset-2fa`
- `DELETE /admin/users/:id/invites/:inviteId`

## Tokens (match our design system; values for reference)

teal primary `#0d9488` (soft `#f0fdfa`), amber accent `#f59e0b`, red danger `#dc2626`; neutral text `#0f172a / #334155 / #64748b / #94a3b8`; radii 6/8/10/12/999; 8px spacing grid; Inter + JetBrains Mono. Drawer entrance 0.18s ease, bulk bar 0.18s, backdrops 0.12s.

## Accessibility

Icon-only buttons need `aria-label`s; sortable `<th>` should expose `aria-sort`; drawer is `role="dialog"` with a focus trap + return-focus-on-close; status chips a sensible group role.

## Open questions to confirm before shipping

Suspend semantics (revoke sessions now vs block future sign-in?), 2FA-reset step-up + user notification, invite expiry (prototype: 7d), and whether service accounts are editable here or read-only (API-keys is source of truth). Flag these rather than guessing.
