# Admin UI Implementation Spec

**Date:** May 14, 2026  
**Project:** Flagraft Admin UI  
**Scope:** Complete implementation of flags management interface with context overrides feature

## Overview

Implement a production admin UI for Flagraft feature flag management based on the finalized design in `/flagraft-design/project/`. The implementation targets React 18 + TypeScript with Tailwind CSS, replacing the prototype's browser-based React with a properly packaged component library.

## Key Features

### 1. Flags List (Redesigned)

- **Filtering**: Search by name/key/description, tag-based filtering, state-based filtering (on/off/overrides/kill-switches)
- **Sorting**: Clickable column headers (Flag, Last Edited) with ascending/descending toggle
- **Bulk Actions**: Select multiple flags, enable in dev/staging, production toggle with confirmation, add tags, archive
- **Visual Hierarchy**: 
  - Flag name (primary), dotted key (secondary), tag cluster (hover-revealed)
  - Author avatar with name and relative date ("today", "2d ago", etc.)
  - State pills per environment showing ON/OFF + override count
  - Production environment visually distinct (red accent)
  - Kill-switch indicator for critical flags
- **Overrides Preview**: Hover on state pill shows top 4 context overrides with rule preview

### 2. Context Overrides Feature

New section in flag detail view for managing per-environment rules.

**Components:**
- **Environment tabs**: Development, Staging, Production with default state indicator and override count
- **Override form** (inline add/edit):
  - Context key dropdown (filtered from registry)
  - Operator selector (depends on field type: equals, in, starts with, contains, regex for string; equals/in for enum; is for boolean; =/<=/etc for number)
  - Value input (dropdown for enum/boolean, text input for others)
  - Result pill selector (ON/OFF radio buttons)
  - Optional note field
- **Override list** (read-only rows):
  - Numbered display: "if {key} {op} {value} → ON/OFF"
  - Match count from last 7 days (~N matched)
  - Edit/delete actions
  - Hover shows rule syntax
- **Validation**:
  - Duplicate detection (warn if identical rule exists)
  - Conflict detection (warn if same key/value pair returns opposite results)
  - Unregistered field warning with link to settings
  - Match count estimation
- **Empty state**: Icon + messaging + "Add your first override" CTA

### 3. Design System

**Components to implement:**
- Icon (24px SVG library with 30+ icons)
- Button (variants: primary, ghost, danger; sizes: default, sm)
- Toggle (switch with production variant requiring confirmation)
- Checkbox (with indeterminate state)
- Modal (basic backdrop + content)
- PageHeader (title + subtitle + action buttons)
- TextField (input + label + hint text)
- Select (dropdown, supports grouped options)
- Badge/Pill (rounded containers for tags, states)
- Tip (tooltip with accessibility)
- Kbd/KbdHint (keyboard key display)
- Toast (success/warning/error notifications)

**Theming:**
- Light and dark modes (CSS variables)
- Accent color customization (teal, indigo, violet, rose)
- Density toggle (comfortable, compact) affects font-size and row heights
- Color tokens: brand ramp (teal primary, amber accent, red danger), neutral (ink 0-950)
- Spacing grid (4px base, --s-1 through --s-16)
- Radius tokens (--r-sm: 6px, --r-md: 8px, --r-lg: 10px, --r-xl: 12px, --r-pill: 999px)
- Shadow tokens (--shadow-1, --shadow-2, --shadow-3)

**Fonts:**
- Sans: Inter (400, 500, 600, 700)
- Mono: JetBrains Mono (400, 500, 600)

### 4. Data Model & API Integration

**Contexts:**
- `Project` state (current project selection)
- `ActiveEnv` state (current environment: development, staging, production)
- `Route` state (current screen: flags, flag-detail, settings, etc.)
- `Theme` state (light/dark)
- `Tweaks` state (density, accent, annotations visibility)

**Data structures:**
- **Flag**: key, name, description, tags, state (per environment: on, overrides count), author, updated
- **Override**: id, flag, env, contextKey, contextOp, contextValue, result, note, created
- **ContextField** (registry): key, type (string|enum|boolean|number|version|date), source, enumValues?, example?
- **Author**: id, name, initials, color, role

**API endpoints** (existing backend):
- GET `/api/projects` - list projects
- GET `/api/flags` - list flags
- POST/PUT `/api/flags/:key` - create/update flag
- GET `/api/flags/:key/overrides` - list overrides for a flag
- POST/PUT `/api/flags/:key/overrides/:id` - create/update override
- DELETE `/api/flags/:key/overrides/:id` - delete override
- GET `/api/context-fields` - list registered context fields

**Local state management:**
- React Context for theme, tweaks, current project/environment
- Component-level state for filtering, sorting, selection, modals
- Toast provider for notifications

### 5. Error Handling & Edge Cases

- Production toggle requires confirmation modal
- Unregistered context fields show warning in override form
- Duplicate overrides disabled in form
- Conflicting overrides (same key/value, different result) flagged with warning
- Toast notifications for all mutations (success, error)
- Relative date calculation with proper timezone handling
- Empty states for no flags, no overrides, no matches after filtering
- Loading states for API calls
- Graceful degradation if context fields registry unavailable

### 6. Accessibility

- ARIA labels on interactive elements (toggles, buttons, checkboxes)
- Role attributes for custom components (tab, radio, switch)
- Keyboard navigation (Tab, Arrow keys, Enter)
- Keyboard shortcuts: Cmd+K (search), Cmd+Shift+P (project switcher), ? (help), / (focus filter), Shift+D (dark mode), N (new flag), G+{F,O,E,K,A} (navigate)
- Focus outline visible on all interactive elements
- Semantic HTML structure

### 7. Testing Strategy

**Unit tests:**
- Component rendering (flags list, override form, state pill)
- Filter/sort logic
- Operator selection based on field type
- Validation logic (duplicates, conflicts, unregistered fields)
- Date formatting (relative dates)

**Integration tests:**
- Flag list with filtering + sorting + bulk actions
- Override CRUD (create, read, update, delete)
- Theme + density switching
- Keyboard shortcuts

**Manual testing:**
- All happy paths (create/edit/delete flag, override)
- All error cases (duplicate, conflict, unregistered field, API error)
- Theme switching + accent customization
- Responsive behavior (if mobile support planned)

## Architecture

**File structure:**
```
packages/admin-ui/src/
├── components/
│   ├── primitives/        (reusable UI components)
│   │   ├── Button.tsx
│   │   ├── Icon.tsx
│   │   ├── Toggle.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   ├── layout/            (page structure)
│   │   ├── TopBar.tsx
│   │   ├── SideNav.tsx
│   │   └── MainLayout.tsx
│   └── screens/           (full page components)
│       ├── FlagsScreen.tsx
│       ├── FlagDetailScreen.tsx
│       ├── SettingsScreen.tsx
│       └── ...
├── contexts/              (React Context for global state)
│   ├── ThemeContext.tsx
│   ├── ProjectContext.tsx
│   └── ToastContext.tsx
├── hooks/                 (custom hooks)
│   ├── useFlags.ts
│   ├── useOverrides.ts
│   ├── useToast.ts
│   └── ...
├── lib/                   (utilities)
│   ├── api.ts             (API client)
│   ├── format.ts          (date, text formatting)
│   ├── validation.ts      (override validation)
│   └── ...
├── styles/
│   ├── globals.css        (tokens, theme)
│   ├── primitives.css     (component styles)
│   └── ...
├── App.tsx                (main router)
└── main.tsx               (entry point)
```

**Component patterns:**
- Functional components with hooks
- Props interface for each component
- Compound component pattern for complex UI (e.g., Modal with Modal.Header, Modal.Body, Modal.Footer)
- Context for cross-cutting concerns (theme, toast, project)
- Custom hooks for data fetching and local state

## Success Criteria

1. All screens from design render without console errors
2. Filtering, sorting, bulk actions work on flags list
3. Context override CRUD works with validation
4. Theme switching and accent customization work
5. All keyboard shortcuts functional
6. Production toggle requires confirmation
7. Responsive layout (if applicable)
8. API integration with `/api/` endpoints working
9. Toast notifications for all mutations
10. No accessibility violations (WCAG 2.1 AA)

## Constraints & Dependencies

- Backend API must provide endpoints for flags, overrides, context fields (assumed available)
- Tailwind CSS tokens for Knowmax brand already configured
- React Router v6+ (already in package.json)
- Vite dev server with API proxy configured (already set up)
- Design system CSS can reference existing component library or be built from scratch

## Out of Scope

- Mobile-specific optimizations (unless explicitly required)
- Analytics tracking
- Real-time collaboration features
- Audit log UI
- Advanced permission management UI
- Internationalization (i18n)
