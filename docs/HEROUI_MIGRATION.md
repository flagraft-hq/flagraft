# HeroUI migration plan

Replacing the hand-written admin UI component layer with [HeroUI](https://www.heroui.com) as the
UI framework, so the project stops maintaining its own components and CSS.

This is a plan, not a commitment to a date. Phases are ordered so the work can stop after any one
of them and leave the app in a shipping state.

## Why

The admin UI is 52 hand-rolled components — 17 primitives, 28 screens, 7 layout — and 5,633 lines
of CSS, maintained by one person. None of it is the product. HeroUI is built on React Aria, so adopting it also buys accessibility work that
is currently missing and would otherwise have to be written by hand — focus restoration, table
keyboard navigation, `aria-sort`, screen-reader announcements.

The trade is real and worth stating plainly: the UI stops looking exactly like ours and starts
looking like HeroUI's, and a dependency now sits between us and every screen.

## Prerequisites: done

### Tailwind v4

Required because `@heroui/theme` declares `tailwindcss >=4.0.0` as a hard peer.

- `tailwindcss@4.3.3` with `@tailwindcss/vite`
- `tailwind.config.ts` → `src/styles/theme.css` (`@theme` block)
- `postcss.config.js` and `autoprefixer` deleted
- Two v4 reset regressions compensated in `base.css`: button `cursor: pointer` (19 buttons carry no
  class of their own) and placeholder colour (now `var(--text-4)`)
- Verified by diffing the full selector set of both builds: no app-level CSS changed

### React 19

Not anticipated when this plan was written. `@heroui/react@3.x` declares `react >=19.0.0` as a hard
peer; the app was on 18.3.1. Staying on React 18 would have meant `@heroui/react@2.8.10`, which also
drags in `framer-motion` — the very dependency Phase 1 set out to delete — and would have meant
running the whole 52-component migration against a superseded line and then doing it again.

Upgraded instead. It cost two lines, both standard React 19 type changes:

- `CopyButton.tsx` — `useRef` now requires an explicit initial argument
- `Icon.tsx` — the global `JSX` namespace is gone; `React.JSX.Element` replaces it

564/564 tests passed unchanged afterwards. The bundle grew 110.3 → 125.0 KB gzip JS; verified as
React 19 alone by confirming no HeroUI code was in the bundle at that point.

## Decisions: made

### 1. Does Flagraft keep its own look? — **keep our palette**

HeroUI reads its colours from a small set of plain custom properties on the root element. Each one
now points at the token our own stylesheets already use, in a `:root` block at the foot of
`theme.css`.

Only light values are listed, because those tokens are themselves redefined under `.theme-dark` in
`base.css`. Dark mode therefore follows for free, and so does the accent picker, which rewrites
`--teal-*` at runtime — mapping HeroUI's `--accent` to `--pri` (which is `var(--teal-600)`) keeps
that feature alive rather than stranding it.

HeroUI's shapes and spacing are accepted as-is, per the original recommendation.

### 2. What happens to `--color-*: initial` — **removed**

Gone from `theme.css`. HeroUI's stylesheets are written against Tailwind's default palette, so
clearing it would leave HeroUI components with no colour at all. `bg-gray-100` and friends now exist
alongside our tokens.

This surfaced exactly one latent consequence, caught by the selector diff: `index.html` carried
`text-slate-900` on `<body>`, inert while the palette was cleared and live again afterwards. Our
unlayered `body { color: var(--text-1) }` still won, so nothing rendered differently — but it was a
dark-mode trap one cascade change away from firing. The dead class was removed.

### 3. Dark mode bridge — **done**

`ThemeContext` now applies `dark` alongside `theme-dark`. Covered by a permanent test in
`ThemeContext.test.tsx` rather than the throwaway button the plan originally called for.

### 4. Is the table the reason, or a symptom? — **full migration**

Asked and answered: proceed with the full 52-component migration. The Phase 2 decision gate stands.

### 5. Name collisions — found during Phase 1, not anticipated

Thirteen custom-property names are defined by both HeroUI and this app. Our stylesheets are
unlayered and HeroUI's are inside `@layer base`, and unlayered beats layered regardless of load
order, so ours win every collision. For `--danger` and `--border` that is the palette bridge working
as intended and both are deliberately left out of the bridge block.

One collision was a genuine defect rather than a preference:

> **`--focus`** — ours held a **box-shadow** (`0 0 0 3px rgba(...)`), HeroUI's holds a **colour**.
> Ours would have won and fed a shadow string to a colour property, breaking the focus ring on every
> HeroUI component in the app.

Ours was renamed to `--focus-ring` across 17 sites in 8 stylesheets, and `--focus` was handed to
HeroUI in the bridge block. Renaming ours was the right direction: `--focus` is HeroUI's documented
API and `--focus-ring` is only ours.

## Constraints and risks

| Fact                                                 | Consequence                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 564 tests across 52 files                            | Tests query by role and text; HeroUI changes DOM structure. Expect heavy churn, and treat every rewritten assertion as a chance to silently drop coverage.                                       |
| Button used in 26 files, Modal 18, Select 10, Tip 10 | Leaf primitives have the widest blast radius. They go first, one per PR.                                                                                                                         |
| Sorting, filtering and pagination are server-side    | HeroUI's table takes `sortDescriptor` / `onSortChange`. Wire those to the existing API params. Do **not** let it sort client-side — it would sort only the current page and look like it worked. |
| After Phase 1: 125 KB gzip JS, 18 KB gzip CSS       | Was 110 / 16. The JS delta is React 19, not HeroUI — no HeroUI code is in the bundle yet. **Ceiling: 165 KB gzip JS (+50%).** Measure again after the pilot screen, not at the end.              |
| HeroUI 3 ships all component CSS in one file         | Plain CSS does not tree-shake. Import per-component stylesheets alongside the components that use them, never the `@heroui/styles` barrel — that alone is +36 KB gzip.                           |
| `radix-ui` and `motion` are not installed            | Already gone. Note that `@heroui/react` itself depends on `@radix-ui/react-avatar`, so Radix returns transitively regardless.                                                                    |
| 5,633 lines of CSS in 14 files                       | Deleting it is the main prize. It only gets deleted when the last consumer of each rule is gone, so retirement is per-file and late.                                                             |

## Phases

### Phase 1 — Foundation — **done**

No visual change. Nothing replaced yet.

Three of the six steps as written did not survive contact with HeroUI 3, which is a different
product from the v2 this plan was drafted against:

| Planned                                                    | Actual                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `add @heroui/react`                                        | Done — plus five hard peers: `react-aria`, `react-aria-components`, `@react-aria/{i18n,ssr,utils}`              |
| `HeroUIProvider` at the app root                           | **Does not exist in v3.** No provider is needed; components are imported and used directly                      |
| HeroUI's Tailwind plugin via `@plugin`, `@source` scanning  | **No plugin in v3.** It ships plain CSS, wired by `@import` in `index.css`                                      |
| Decisions 1 and 2                                          | Done — see above                                                                                               |
| `ThemeContext` applies `dark`                              | Done, with a test                                                                                              |
| Remove `radix-ui` and `motion`                             | Already absent from every `package.json` — no-op                                                               |

The CSS import needed one deliberate departure. HeroUI's `@heroui/styles` entry point pulls in every
component's stylesheet at once: **52.1 KB gzip, against a 16.2 KB baseline**, for components this app
does not render, and plain CSS does not tree-shake. `index.css` imports only the four always-needed
pieces (`base`, `themes/default`, `utilities`, `variants`) instead. Each component's own stylesheet
gets imported next to the component that uses it, so the cost arrives with the component. That is
**18.3 KB gzip**, i.e. +2.1 KB for the foundation rather than +36 KB.

**Verified:**

- Build succeeds; typecheck clean
- 565 tests pass (564 baseline, unchanged, plus the new dark-bridge test)
- App renders identically — confirmed by diffing the full selector set against the pre-HeroUI build:
  **zero selectors lost**, five gained, all of them HeroUI's own custom-property scaffolding
  (`:root,.light,…`, `.dark,[data-theme=dark]`, `::view-transition`, two `[data-vibrant-palette]`
  rules). None restyles an app element.
- Palette bridge confirmed in the built CSS, including that it lands **unlayered** and so wins over
  HeroUI's `@layer base` values, and that no box-shadow leaks into `--focus`
- A throwaway HeroUI `Button` mounted and rendered under React 19, then was deleted as planned

One cosmetic regression accepted: jsdom cannot parse HeroUI's CSS, so `Could not parse CSS
stylesheet` now prints twice per test run. `vitest.config.ts` sets `css: true` deliberately; no test
asserts computed styles, so the sheet being dropped in jsdom changes no result. Revisit only if a
future test needs real computed styles.

### Phase 2 — Pilot one screen

Convert **API keys** (`KeysScreen`, 473 lines, one table, no bulk actions, low traffic). Not Users —
it is the most complex screen in the app and a bad first contact.

Deliverables: the screen rebuilt on HeroUI, its tests rewritten, a bundle measurement, and an honest
note on how long it took.

**Verify:** compare gzip bundle before/after; count test lines changed; screenshot both themes.

**Decision gate.** If the pilot is disproportionate to the gain, stop here. One converted screen is
a survivable amount of inconsistency; forty per cent of an app is not. The pilot is also the only
honest estimate available — 52 components is the number to multiply, and it comes from this screen.

### Phase 3 — Primitives, leaf-first

One primitive per PR, each with its tests updated and its CSS deleted in the same change.

| Ours                                                                             | HeroUI       | Files affected | Notes                                                    |
| -------------------------------------------------------------------------------- | ------------ | -------------- | -------------------------------------------------------- |
| `Button`                                                                         | `Button`     | 26             | Widest blast radius; do it first while attention is high |
| `TextField`                                                                      | `Input`      | 8              |                                                          |
| `Select`                                                                         | `Select`     | 10             |                                                          |
| `Checkbox`                                                                       | `Checkbox`   | 3              |                                                          |
| `Toggle`                                                                         | `Switch`     | 5              |                                                          |
| `Badge`                                                                          | `Chip`       | 7              | HeroUI's `Badge` is a notification dot, not this         |
| `Tip`                                                                            | `Tooltip`    | 10             |                                                          |
| `Kbd`                                                                            | `Kbd`        | 4              |                                                          |
| `Pagination`                                                                     | `Pagination` | 4              | Keep server-driven offset/limit                          |
| `Modal`                                                                          | `Modal`      | 18             | Focus restoration comes free; see the note below         |
| `Icon`                                                                           | —            | —              | Keep. Our own set, no HeroUI equivalent                  |
| `CopyButton`, `FormError`, `ErrorState`, `Denied`, `PasswordStrength`, `BulkBar` | —            | —              | Keep, recomposed from HeroUI parts                       |

Modal note: a prototype confirmed Radix restores focus only to its own `Trigger`, and our modals
open from arbitrary buttons. HeroUI is React Aria underneath and likely has the same constraint —
check it explicitly rather than assuming, and if so capture `document.activeElement` on open and
restore it on close.

### Phase 4 — Screens

Convert screen by screen, simplest first: Environments → Context fields → Settings → Flags →
Flag detail → Users. Users last: it has search, two filters, sorting, pagination, row selection,
bulk actions, row actions and a deep-linked drawer.

### Phase 5 — Retire the CSS

Per-file deletion as each file's last consumer disappears. Rough order:
`primitives.css` (599) → `keys.css` (214) → `tables.css` (93) → `modals.css` (145) →
`environments.css` (163) → `flags.css` (597) → `flag-detail.css` (624) → `settings.css` (712) →
`users.css` (856) → `auth.css` (488) → `layout.css` (377).

`base.css` (530) and `theme.css` survive: they hold the design tokens HeroUI is themed from.

**Verify:** each deletion is its own commit, so a missed rule is one `git revert` away.

### Phase 6 — Cleanup

Remove dead helpers, update the admin UI README, and record the decision in `docs/ROADMAP.md`.

## Testing strategy

The 564 tests are the safety net for all of the above, and the thing most likely to be quietly
damaged. Rules:

- Rewrite assertions to match HeroUI's DOM; never delete a test to make a phase pass.
- Test count should not drop between phases. If it does, the PR says why.
- Prefer role- and label-based queries over class names — they survive the next migration too.
- Keep `ThemeContext` tests as they are; they cover the bridge in decision 3.

## Rollback

Every phase is independently revertible, which is why primitives are one-per-PR. The riskiest
single commit is Phase 1's `--color-*: initial` removal, since it changes what every utility class
in the app resolves to — do it alone, not bundled with anything else.

## Open questions

- Does HeroUI's `Table` restore focus and announce sort state correctly with server-driven data, or
  does it need the same manual handling as the modal? Answer during Phase 2.
- ~~Do we adopt HeroUI's dark palette or keep ours?~~ **Ours, and it came free.** The bridge maps
  HeroUI's tokens to ours by name; ours flip under `.theme-dark` already, so dark needed no separate
  block. HeroUI's own `.dark` rule is layered and loses to our unlayered bridge.
- ~~Bundle ceiling?~~ **165 KB gzip JS (+50% on the 110 KB baseline).** Currently 125 KB, all of it
  React 19. That leaves roughly 40 KB of headroom for HeroUI itself — worth re-checking against the
  pilot rather than assuming it is enough.
