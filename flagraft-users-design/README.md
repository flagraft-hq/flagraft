# Handoff: Users management & Login screens

## Overview

This handoff adds two new screens to the Flagraft admin: a **Login** (sign-in) screen and a workspace-wide **Users** management screen. They extend the existing prototype (flags, environments, API keys, audit log, project settings) without changing any of the prior screens.

Two distinct concepts:

- **Users** (workspace-level) — every human and service account that can sign into the workspace, regardless of which projects they're in. Lives under `CONFIGURE → Users` in the side nav.
- **Members** (project-level) — already exists at `Project settings → Members & roles`. Scoped to a single project. **Keep both.** They serve different jobs.

## About the design files

The files in this bundle are **design references created in HTML/React-in-Babel** — high-fidelity prototypes showing intended look, layout, copy, and behavior. They are **not production code**. The task is to recreate these designs in your target codebase's environment using its existing patterns, primitives, and data layer.

Where the prototype uses ad-hoc helpers (`Icon`, `Button`, `Badge`, `Modal`, `Toggle`, `Checkbox`, `Tip`, `PageHeader`, `Checkbox`, `useToast`), substitute the equivalents from your component library.

## Fidelity

**High-fidelity.** Pixel-perfect mockups with final colors, typography, spacing, and interactions. The developer should recreate the UI pixel-perfectly. All token values used are listed under [Design tokens](#design-tokens) below.

---

## Screens

### 1. Login screen

**Purpose:** Authenticate a user into the Flagraft workspace. Supports three modes:

- Password (default)
- Magic link (passwordless, one-time email link)
- SSO redirect (Google, SAML)

**Layout:** Full-viewport, two-column split, `grid-template-columns: 1fr 1.05fr`.

| Region              | Width     | Notes              |
| ------------------- | --------- | ------------------ |
| Brand panel (left)  | flex 1    | Hidden below 880px |
| Form column (right) | flex 1.05 | Always visible     |

#### Brand panel (left)

- Background: layered radial gradients + linear gradient
  - `radial-gradient(ellipse 80% 60% at 25% 18%, rgba(45,212,191,0.32), transparent 60%)`
  - `radial-gradient(ellipse 70% 50% at 85% 80%, rgba(13,148,136,0.28), transparent 65%)`
  - `linear-gradient(140deg, #052321 0%, #0b3a35 50%, #0f766e 100%)`
- Grid texture overlay: two crossed linear-gradients at 56px spacing, 4% white alpha, masked with a radial gradient so it fades at the edges
- Padding: `48px 56px`
- Rows: `auto 1fr auto auto` (brand mark / pitch / stats / status pill)

Contents top-to-bottom:

1. **Brand mark + wordmark.** 40×40 `FR` square (teal gradient, white inset highlight, large outer glow), and `Flagraft` text, 17px / 700 / -0.01em letter-spacing.
2. **Pitch.** `h1` at 40px / 700 / -0.02em / line-height 1.08, two lines: `Feature flags / without the ceremony.` (use a `<br/>` not the soft-hyphen the prototype uses for the nbsp). Subhead at 15px, line-height 1.55, opacity ~78%: "Self-hosted. Three environments out of the box. Sub-50ms evaluations from any region."
3. **Stats row.** 3 columns, `gap: 18px`, with a 1px white-alpha top border at 28px padding-top:
   - `24` flags · this project
   - `98%` cache hit · last 24h
   - `42ms` p99 eval · prod
     Numerals at 26px / 700, units inline at 14px / 500. Labels at 11.5px, 55% white alpha, 0.01em tracking.
4. **Status pill.** "All systems operational" + version stamp `v1.4.2`. Pill: black 20% bg, white 8% border, 999px radius, 10px×14px padding. Status dot is a 8px green circle (`#4ade80`) with a pulsing `livepulse` animation (2.4s ease-out infinite).

#### Form column (right)

- Background: `var(--bg-elev)` (`#ffffff` light, `#111a2c` dark)
- Rows: `auto 1fr` (top bar, form area)

**Top bar:** right-aligned, 16×28 padding, bottom border `1px solid var(--border)`.

- "New to Flagraft?" (12.5px, muted)
- Ghost button "Create workspace" with right arrow icon

**Form area:** centered vertically and horizontally. Form max-width `380px`. Vertical gap between groups: 18px.

Structure (in order):

1. **Heading.** Title 22px / 600 / -0.012em. Default: "Sign in to Flagraft". Magic mode: "Email me a sign-in link". SSO mode: "Continue with SSO". Subhead 13.5px line-height 1.5.

2. **SSO stack.** Two large buttons, full-width, 42px tall, 14px left padding, 10px gap, 13.5px / 500 text:
   - **Continue with Google** — uses the Google G mark (multi-color SVG, four paths: blue `#4285F4`, green `#34A853`, yellow `#FBBC05`, red `#EA4335`)
   - **Continue with SAML SSO** — shield icon left, optionally trailing "kocharsoft.com" meta in 11px text-4 mono if the entered email matches a known SSO domain

3. **Divider.** Three-column grid `1fr auto 1fr`. Center label "OR WITH EMAIL", 11px / 600 / uppercase / 0.08em tracking / text-4. Side rules: 1px borders.

4. **Email field.** Label "Work email". Input has:
   - User icon at `left: 12px`
   - 40px tall, `padding-left: 36px`
   - Right side: when the email domain matches an SSO-enabled domain, show a small `SSO` pill (`var(--pri-soft)` bg, `var(--pri-fg)` color, 999px, uppercase, 10px / 700) with a tooltip "This workspace uses SAML · Okta"

5. **Password field** (only in password mode). Label row has `Forgot?` link on the right (small teal link).
   - Key icon at left
   - Show/hide button at right (eye / eye-off, 28×28, transparent → bg-hover)
   - On password keyup, detect caps lock via `e.getModifierState('CapsLock')` and show an inline hint `Caps Lock is on` in amber-fg
   - Error state: border `var(--danger)`, message below in danger-fg with alert icon

6. **Remember row** (password mode only). Toggle (small size, 30×17), label "Remember this device for 30 days", spacer, "2FA" tag (small teal pill with shield icon) and tooltip "2FA is required by your workspace policy".

7. **Submit button.** Full-width, 44px tall, primary variant (teal). Right arrow icon when idle. When submitting: replace icon with a 14px CSS spinner (border-radius 999, 2px border with `border-top-color: currentColor`, `spin 0.7s linear infinite`), label "Signing in…".

8. **Alt-mode link.** Center-aligned text link to switch between password and magic. Sparkles icon for "Email me a sign-in link instead", reversed arrow for going back.

9. **Footer.** Dashed top border. Self-hosted hostname stamp `flagraft.kocharsoft.internal` in mono. Right side: Docs / Status / Privacy links.

**Magic-link sent state:** replaces the form with a centered confirmation:

- 48px circle, `var(--pri-soft)` background, teal-fg check icon
- `Check kochar@kocharsoft.com` heading
- Muted body: "If an account exists, you'll receive a sign-in link shortly. The link expires in 10 minutes."
- Buttons: "Use password instead" (ghost), "Resend" (ghost)

#### Interactions / behavior

- **Submit handler** is a single `submit(e)` that branches on `mode`. Simulated network latency: 600ms (magic), 800–900ms (sso/password).
- **Password validation in the demo:** rejects empty, anything < 4 chars, or the literal `password`. Real implementation should call the real auth endpoint.
- **SSO auto-detection:** parses `@<domain>` from the email; if domain ends in `kocharsoft.com`, returns `{ name: 'Kocharsoft', method: 'SAML · Okta' }`. This drives both the SSO subtitle and the inline `SSO` pill in the email field.
- **Show/hide password** toggles input `type` between `password` and `text`, swapping the eye/eye-off icon.
- **Remember device:** boolean stored, defaults to true.
- **On successful sign-in:** call `onSignedIn?.()`. In the prototype, that routes to the Flags screen.

---

### 2. Users screen

**Purpose:** Workspace-wide user directory. Admin view of every human + service account with access to the workspace.

**Layout:** Standard shell content area. Top to bottom:

1. PageHeader ("Users" title + sub + actions)
2. Stat strip — 4 cards, equal columns, 12px gap
3. Toolbar — search + status chips + role select
4. Table card
5. Bulk action bar (floating, fixed) — only when selections exist
6. Detail drawer (right-aligned overlay) — opens on row click
7. Invite modal — opens from primary action

#### Page header

- Title: "Users"
- Subtitle: "Everyone with access to this workspace — across all projects. Project-specific access lives under [Project settings → Members]."
- Actions (right-aligned):
  - Ghost "Export CSV" with code icon
  - Primary "Invite user" with plus icon → opens Invite modal

#### Stat strip

Grid: `repeat(4, 1fr)` desktop, `repeat(2, 1fr)` below 1100px. Cards are `display: grid; grid-template-columns: 32px 1fr; gap: 12px` with a 32px tinted icon square on the left and label/value/sub stacked on the right.

| Card            | Value          | Sub                     | Icon     | Tone                             |
| --------------- | -------------- | ----------------------- | -------- | -------------------------------- |
| Total users     | 12             | "10 active · 2 service" | user     | teal                             |
| Pending invites | 2              | "Expires in **7 days**" | sparkles | amber, with left-edge accent bar |
| 2FA enforced    | 80% (computed) | "2 without 2FA"         | shield   | teal                             |
| Seats           | 12/25          | "13 remaining"          | layers   | slate                            |

Value typography: 22px / 700 / -0.02em / tabular nums. Unit suffix (e.g. `/25`) at 13px / 500 / text-4.

When a card is `warn`, add a 3px left accent bar in `var(--acc)` (amber), inset 12px top/bottom, border-radius 0 3px 3px 0.

#### Toolbar

Single card-styled bar: 10×12 padding, border, shadow-1, gap 12px, wraps below.

- **Search input.** Min-width 240, max-width 360. Search icon left, 30px tall, 13px text. Clear button (x in a 20×20 circle) appears when there's input.
- **Status chip group.** Pill-style multi-state filter (single-select). Chips:
  - All (n) — default state
  - Active (n)
  - Invited (n) — amber when pressed
  - Suspended (n) — red when pressed
  - Service (n) — counts service accounts; selecting this filter restricts to service accounts only and excludes them from other status filters
- **Role select** — pushed right. `all roles / owner / admin / editor / viewer`. 32px tall, auto width.

Chips reuse the existing `.chip` class from the Flags v2 redesign. Pressed state takes a colored background + matching border + matching foreground. `data-tone="red"` / `data-tone="amber"` switches the pressed palette to danger/accent rather than the default teal.

#### Table

Columns (left to right):

| Header         | Width hint | Content                                                                                   |
| -------------- | ---------- | ----------------------------------------------------------------------------------------- |
| (checkbox)     | 40px       | Per-row checkbox; header is select-all with mixed/indeterminate state                     |
| Person         | flex       | Avatar (28px) + name + status badges + monospace email below                              |
| Role           | auto       | RoleBadge — colored dot pill: `owner=amber, admin=teal, editor/viewer=slate`              |
| Project access | flex       | Up to 2 project chips + "+N" overflow if more                                             |
| 2FA            | auto       | TwoFA pill: ok=teal (shield/key/info icon + label), none=amber alert                      |
| Last active    | auto       | Mono 12px; "never" italicized in text-4                                                   |
| (actions)      | auto       | Icon buttons: edit + suspend/reinstate for active/suspended, refresh + cancel for invited |

Sortable headers (Person, Role, Project access, Last active) use `<button class="sort-head">` with a chevron-down icon that rotates 180° when `dir === 'asc'`. Active sort key shows the chevron in `var(--pri-fg)`.

Row states:

- **Hover:** background `var(--bg-muted)`
- **Selected (checkbox):** background `var(--pri-soft)`
- **Active (drawer open):** background `var(--pri-soft)`, inset 3px left teal bar (`box-shadow: inset 3px 0 0 var(--pri)`)
- **Invited row:** subtle left-edge amber fade `linear-gradient(90deg, rgba(245,158,11,0.04), transparent 30%)`
- **Suspended row:** name + email opacity 0.6

Click row body → opens detail drawer.
Click checkbox cell → toggles selection (stop propagation).
Click action buttons → don't open drawer (stop propagation).

Footer strip below table: 10×14 padding, `var(--bg-muted)`, top border, shows `{filtered.length} of {total} users` on the left and `Provisioning via SCIM 2.0 · Okta` on the right.

#### Bulk action bar

Floats fixed at `bottom: 18px, left: 50%, translateX(-50%)`. Pill-shaped, dark in light mode (`var(--text-1)` bg, inverse text). Existing `.bulk-bar` class is reused exactly as on the Flags v2 screen.

Contents:

- `{N} selected` counter
- Separator
- **Role** section label, "Change role…" button
- Separator
- **Access** section label, "Add to project" button, "Require 2FA" button
- Separator
- Danger button "Suspend"
- Close button (32×32 circle) clears selection

#### Detail drawer

Right-anchored, 480px wide, full height. Animates in from the right (`translateX(20px) → 0`, 0.18s ease, with opacity).

Rows: `auto auto 1fr auto` — top bar / hero / body / footer.

- **Top bar:** close icon (x) on left, copy + history icon buttons on right.
- **Hero:** background `var(--bg-muted)`, padding 18×22, bottom border.
  - 56×56 colored avatar with initials, radius 14
  - Name h2 (18px / 600 / -0.01em)
  - Mono email at 12.5px / text-3
  - Row of badges: RoleBadge + status (active/invited/suspended) + service tag if applicable
- **Body** (scrollable):
  - **Details** section — labelled rows in a definition-list pattern. Left label 110px wide / text-3. Right value bold text-1, mono where appropriate. Fields: User ID, Joined, Last active, 2FA, Source (`scim · okta` or `service-account`).
  - **Project access (N)** — stack of project cards (28×28 project avatar + name + role, with a small x button to remove). Below them an "Add to project" dashed-border button that highlights teal on hover.
  - **Recent activity** — bordered list with grid `100px 1fr`. Each row has a mono timestamp + an action sentence with inline mono code chunks (`checkout.apple-pay`, `staging`, `cohort=beta`, IP, etc.). Demo content is fine; wire to real audit later.
- **Footer:** `var(--bg-muted)`, top border, 14×22.
  - Ghost "Reset password" (refresh icon)
  - Ghost "Reset 2FA" (shield icon)
  - Spacer
  - Right-aligned primary: "Reinstate" if suspended, else danger "Suspend" (disabled for `owner`)

Esc key closes the drawer.

#### Invite modal

Standard `Modal size="lg"`. Sections:

1. **Email addresses** — `textarea.input.textarea.mono`, min-height 76, comma-/whitespace-separated. Hint below shows parsed count: `{N} recipients parsed`.
2. **Workspace role + Default 2FA** — two-column field row, native selects.
   - Role hint changes with selection (admin / editor / viewer copy)
3. **Project access** — chip group, multi-select. Each chip has a small project avatar + name + check icon when selected. Uses `aria-pressed`.
4. **Info message** — `.form-msg.info` reusing the existing pattern: "Invitees receive a one-time link. Their account is created on first sign-in. SAML SSO users (matching `@kocharsoft.com`) skip the password step."

Footer:

- Ghost "Cancel"
- Spacer
- Primary "Send {N} invites" (disabled if 0 emails or 0 projects)

On send: close modal, toast `Invites sent` with subtitle `{N} emails dispatched.`.

---

## Interactions & behavior

| Event                              | Effect                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| Side nav `Users`                   | Routes to `users` screen                                                           |
| Side nav `Login screen`            | Routes to `login` (replaces shell with full-bleed login)                           |
| Command palette `g u`              | Same as Users                                                                      |
| Click row                          | Opens detail drawer                                                                |
| Click row checkbox                 | Toggles selection; reveals bulk bar                                                |
| Header checkbox                    | Select-all-filtered (with mixed indicator if partial)                              |
| Click sortable header              | Cycles sort (asc/desc; new key resets to desc)                                     |
| Search input                       | Live-filters by name + email + project list                                        |
| Status chip                        | Single-select status filter                                                        |
| Role select                        | Filter by role                                                                     |
| Status `system` filter             | Restricts to service accounts only; other filters hide service accounts by default |
| Esc when drawer open               | Closes drawer                                                                      |
| Esc when modal open                | Closes modal (existing `Modal` behavior)                                           |
| Invite "Send"                      | Closes modal + success toast                                                       |
| Reset filters button (empty state) | Clears search + status + role                                                      |

## State management

### Login

```ts
mode: 'password' | 'magic' | 'sso'
email: string
password: string
showPw: boolean
remember: boolean
submitting: boolean
error: { field: 'password', msg: string } | null
magicSent: boolean
capsOn: boolean
```

Derived: `ssoDomain` from email.

### Users

```ts
q: string                              // search query
statusFilter: 'all'|'active'|'invited'|'suspended'|'system'
roleFilter: 'all'|'owner'|'admin'|'editor'|'viewer'
sortBy: { key: 'name'|'role'|'projects'|'last', dir: 'asc'|'desc' }
selected: Set<string>                  // user ids
detail: User | null                    // drawer
showInvite: boolean
```

Derived:

- `counts` — totals per status, memoized over USERS
- `filtered` — filter + sort pipeline, memoized over [q, statusFilter, roleFilter, sortBy]
- `allChecked`, `someChecked` — for the select-all checkbox

### Data fetching

The prototype uses a static `USERS` array (shape documented at the top of `screens-users.jsx`). Replace with your auth/admin API. Suggested endpoints:

- `GET /admin/users` — list (paginated; the prototype assumes ≤25)
- `GET /admin/users/:id` — drawer detail (incl. recent activity)
- `POST /admin/users/invite` — body `{ emails: string[], role, projects: string[] }`
- `PATCH /admin/users/:id` — role, status (suspend/reinstate), 2FA reset
- `POST /admin/users/:id/reset-password` — sends reset link
- `DELETE /admin/users/:id/invites/:inviteId` — cancel pending invite

User shape:

```ts
type User = {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  status: 'active' | 'invited' | 'suspended'
  twoFA: 'app' | 'key' | 'sms' | 'none'
  last: string // human-formatted last-active
  projects: string[] // project names (real impl: ids w/ separate lookup)
  joined: string // date or 'Pending'
  initials: string // computed from name; 1–2 chars
  tone: 'teal' | 'amber' | 'violet' | 'slate' // for avatar color
  system?: boolean // service account
}
```

---

## Design tokens

These are pulled from the existing Flagraft design system. Use the values already in your `styles.css` rather than re-defining.

### Colors

Brand teal (primary): `--teal-400 #2dd4bf`, `--teal-500 #14b8a6`, `--teal-600 #0d9488`, `--teal-700 #0f766e`.
Amber (accent): `--amber-400 #fbbf24`, `--amber-500 #f59e0b`, `--amber-700 #b45309`.
Red (danger): `--red-500 #ef4444`, `--red-600 #dc2626`, `--red-700 #b91c1c`.
Neutral ramp: `--ink-50 #f8fafc` → `--ink-900 #0f172a`.

Semantic (light theme):

- `--bg-app #f6f7f9`
- `--bg-elev #ffffff`
- `--bg-subtle #f1f5f9`
- `--bg-muted #f8fafc`
- `--bg-hover #f1f5f9`
- `--border #e5e9ef`
- `--text-1 #0f172a`, `--text-2 #334155`, `--text-3 #64748b`, `--text-4 #94a3b8`
- `--pri var(--teal-600)`, `--pri-soft var(--teal-50)`, `--pri-soft-border #cbeae3`, `--pri-fg var(--teal-700)`
- `--acc var(--amber-500)`, `--acc-soft var(--amber-50)`, `--acc-soft-border #f6e2b6`, `--acc-fg var(--amber-700)`
- `--danger var(--red-600)`, `--danger-soft var(--red-50)`, `--danger-soft-border #fecaca`, `--danger-fg var(--red-700)`

Dark theme parallels are documented in `styles.css` under `.theme-dark` and were not changed by this addition.

### Typography

- Sans: `Inter` (weights 400, 500, 600, 700)
- Mono: `JetBrains Mono` (weights 400, 500, 600)
- Body base: 14px / 1.5

Specific sizes used in these screens:
| Element | Size / weight / tracking |
|---|---|
| Login pitch h1 | 40 / 700 / -0.02em / lh 1.08 |
| Login pitch sub | 15 / 400 / lh 1.55 |
| Login stat number | 26 / 700 / -0.02em / tabular |
| Form h2 | 22 / 600 / -0.012em |
| Form input | 13 / 500 |
| Page title (Users h1) | 22 / 600 / -0.01em |
| Stat value | 22 / 700 / -0.02em / tabular |
| Stat label | 11 / 600 / uppercase / 0.06em |
| Table header | 11 / 600 / uppercase / 0.06em |
| Row name | 13.5 / 600 / -0.005em |
| Row email | 12 / mono / text-3 |
| Drawer name h2 | 18 / 600 / -0.01em |

### Spacing scale (8px grid)

```
--s-1 4   --s-2 8    --s-3 12   --s-4 16
--s-5 20  --s-6 24   --s-8 32   --s-10 40
--s-12 48 --s-16 64
```

### Radius

```
--r-sm 6   --r-md 8   --r-lg 10   --r-xl 12   --r-pill 999
```

### Shadow

```
--shadow-1 0 1px 2px rgba(15,23,42,0.04)
--shadow-2 0 1px 3px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)
--shadow-3 0 4px 12px rgba(15,23,42,0.08), 0 12px 32px rgba(15,23,42,0.10)
```

### Motion

- `livepulse` 2.4s ease-out infinite — the green status dot on the login brand panel
- `spin` 0.7s linear infinite — submit-button spinner
- `drawerIn` 0.18s ease — user detail drawer entrance
- `fadein` 0.12s ease — drawer/modal backdrops
- `bulkup` 0.18s ease-out — bulk action bar entrance

### Iconography

All icons are inline SVGs at 1.5px stroke with rounded joins, viewBox 24×24. New screens use existing icons: `user, key, shield, sparkles, layers, edit, trash, refresh, x, check, minus, alert, info, arrowRight, copy, history, chevronDown, eye, eyeOff, plus, bolt, code, search`. The Google G mark is a separate filled multi-color SVG inlined in `screens-users.jsx` (`GoogleG` component).

---

## Files in this bundle

| File                   | What it is                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `screens-users.jsx`    | Both new screens + sub-components. Self-contained module that registers `LoginScreen` and `UsersScreen` on `window`.                                                                 |
| `styles-additions.css` | The new CSS sections appended to `styles.css` — `/* Auth / Login screen */` and `/* Users directory */`. Add these to your existing stylesheet, or translate to your styling system. |
| `app.jsx`              | Modified routing — adds `login` and `users` routes; `login` short-circuits before the shell renders so it appears full-bleed.                                                        |
| `shell.jsx`            | Modified `NAV` array (adds Users + Login screen entries) and command palette items (adds `g u` to Users, and an "Invite user" action).                                               |
| `index.html`           | Adds `<script type="text/babel" src="screens-users.jsx"></script>`.                                                                                                                  |

### Wiring contract

If you're not literally porting these JSX files but reimplementing, here's the contract you need to honor:

1. **Routing.** Add two routes. `login` must short-circuit the layout so the shell (top bar + side nav + main) is replaced entirely by the login viewport. `users` lives inside the regular shell content area.
2. **Side nav.** Under the `CONFIGURE` group, add `Users` after `API keys`, with a count badge (12) and shortcut `g u`. Under the `EXPLORE` group, add `Login screen` after the existing items.
3. **Command palette.** Add `Go to → Users` (`g u`), `Go to → Login screen`, and `Actions → Invite user`.
4. **Sign-in transition.** Successful login should navigate to the Flags screen.

---

## Open product questions to resolve before shipping

These were left as reasonable assumptions in the prototype. Confirm with product/eng:

- **2FA reset:** Should this require step-up auth (re-enter password)? Should it notify the affected user by email?
- **Suspend semantics:** Does suspending revoke active sessions immediately, or just block sign-in going forward?
- **Owner transfer:** The prototype disables Suspend for owners and the bulk action treats owners as a no-op. Confirm the actual owner-transfer flow (it's not in this scope).
- **Invite expiry:** Prototype says 7 days. Confirm.
- **SCIM provisioning:** The footer claims SCIM 2.0 via Okta. If you provision via SCIM, the Invite modal should warn that the source-of-truth is the IdP, or be hidden entirely depending on workspace mode.
- **Service accounts:** Should they be editable from the Users screen at all, or is this read-only (`API keys` is the source of truth)? Prototype shows them but doesn't expose edit affordances meaningfully.
- **Login error copy:** "That password doesn't match the account." — generic on purpose. Confirm with security.
- **Rate limiting / lockout on login** — not modeled.

## Accessibility checklist

- All icon-only buttons in the prototype have `aria-label`s; carry these over.
- Status filter chip group uses `role="tablist"` semantically (visually a chip group; reuse what fits your a11y conventions).
- Sortable headers are real `<button>` elements; consider adding `aria-sort` on the `<th>` for screen readers.
- Drawer is `role="dialog"` with `aria-label`. Confirm focus trap + return-focus-on-close in your impl.
- Password show/hide announces label via `aria-label`. Toggle the label text when state changes.
- Toggle component (`role="switch"`, `aria-checked`) reused as-is.

## Assets

- **Fonts:** Inter + JetBrains Mono via Google Fonts (already linked from `index.html`).
- **Icons:** All inlined SVG — no external icon library.
- **Google G logo:** Inlined SVG component (`GoogleG`) in `screens-users.jsx`. Use Google's official brand asset in production.
- **No raster images** are used by either screen.
