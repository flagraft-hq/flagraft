# Phase 8: Backend Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the admin UI to the real Flagraft backend API so users can list projects, switch between them, create projects, and create feature flags.

**Architecture:** Fix the API client paths (the client uses `/api/v1/` but the backend is at `/admin/`), fix the mismatched toggle and override endpoint shapes, then wire real project loading into the layout and add create flows for projects and flags. API key is stored in `localStorage` and injected on every request by the existing axios interceptor -- a settings screen input is the only UX needed.

**Tech Stack:** React 18, TypeScript, Axios, React Router v6, Vitest, React Testing Library

---

## Known Backend Gaps

Two API client methods have no corresponding backend route and must be replaced:

- `overridesApi.update` -- no `PATCH` override route exists. The edit flow in `ContextOverridesSection` will work by deleting the old override and creating a new one with the updated values inside `useOverrides`.
- `overridesApi.reorder` -- no reorder route exists. Remove from the client.

`contextFieldsApi` path also needs the prefix fix. The endpoint is assumed to exist under `/admin/`.

---

## File Structure

```
packages/admin-ui/src/
├── lib/
│   └── api.ts                          MODIFY -- fix all paths, fix toggle + override shapes
├── hooks/
│   └── useOverrides.ts                 MODIFY -- pass env to API calls, update = delete+create
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx              MODIFY -- use real ProjectContext, wire project switcher
│   │   ├── ProjectSwitcherModal.tsx    CREATE -- list projects, switch, open create
│   │   └── __tests__/
│   │       └── ProjectSwitcherModal.test.tsx  CREATE
│   └── screens/
│       ├── FlagsScreen.tsx             MODIFY -- wire New Flag button
│       ├── CreateFlagModal.tsx         CREATE -- name, key, description form
│       ├── CreateProjectModal.tsx      CREATE -- name, slug, description form
│       ├── SettingsScreen.tsx          MODIFY -- add API key input section
│       └── __tests__/
│           ├── CreateFlagModal.test.tsx     CREATE
│           ├── CreateProjectModal.test.tsx  CREATE
│           └── SettingsScreen.test.tsx      MODIFY -- add API key tests
```

---

## Task 1: Fix API client paths and endpoint shapes

**Files:**

- Modify: `packages/admin-ui/src/lib/api.ts`
- Modify: `packages/admin-ui/src/lib/__tests__/api.test.ts`

### Background

The entire API client uses `/api/v1/` but the backend registers all admin routes under `/admin/`. Additionally:

- `flagsApi.toggle` uses `PATCH .../envs/:env { enabled }` but the backend has two separate endpoints: `POST .../environments/:env/enable` and `POST .../environments/:env/disable`.
- `overridesApi.list` uses a query param `?env=X` but the backend expects env in the URL path: `.../environments/:env/overrides`.
- `overridesApi.create` and `overridesApi.delete` also need `env` in the path.
- `overridesApi.update` and `overridesApi.reorder` have no backend routes -- remove them.
- `projectsApi` needs a `create` method added.

- [ ] **Step 1: Replace the full content of `packages/admin-ui/src/lib/api.ts`**

```typescript
import axios from 'axios'
import type { Flag, Override, ContextField, Project } from './types'

/**
 * Axios instance for API calls.
 * Uses VITE_API_URL or defaults to localhost.
 */
const http = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

/**
 * Injects the API key from local storage into every request header.
 */
http.interceptors.request.use((config) => {
  const key = localStorage.getItem('flagraft_api_key')
  if (key) config.headers['X-API-Key'] = key
  return config
})

/**
 * Global response handler.
 * Clears credentials and redirects to login on 401 Unauthorized errors.
 */
http.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      localStorage.removeItem('flagraft_api_key')
      window.location.href = '/login'
    }
    return Promise.reject(err instanceof Error ? err : new Error(String(err)))
  },
)

export { http }

export const flagsApi = {
  list: (projectId: string) => http.get<Flag[]>(`/admin/projects/${projectId}/flags`),

  get: (projectId: string, key: string) =>
    http.get<Flag>(`/admin/projects/${projectId}/flags/${key}`),

  /**
   * The backend has separate enable/disable endpoints instead of a single PATCH.
   */
  toggle: (projectId: string, key: string, env: string, enabled: boolean) =>
    http.post(
      `/admin/projects/${projectId}/flags/${key}/environments/${env}/${enabled ? 'enable' : 'disable'}`,
    ),

  create: (projectId: string, data: { key: string; name: string; description?: string }) =>
    http.post<Flag>(`/admin/projects/${projectId}/flags`, data),

  update: (
    projectId: string,
    key: string,
    data: Partial<Pick<Flag, 'name' | 'description' | 'tags'>>,
  ) => http.patch<Flag>(`/admin/projects/${projectId}/flags/${key}`, data),

  delete: (projectId: string, key: string) =>
    http.delete(`/admin/projects/${projectId}/flags/${key}`),
}

export const overridesApi = {
  /**
   * env is now a URL path segment, not a query param.
   */
  list: (projectId: string, flagKey: string, env: string) =>
    http.get<Override[]>(
      `/admin/projects/${projectId}/flags/${flagKey}/environments/${env}/overrides`,
    ),

  create: (
    projectId: string,
    flagKey: string,
    env: string,
    data: Omit<Override, 'id' | 'flag' | 'env' | 'created'>,
  ) =>
    http.post<Override>(
      `/admin/projects/${projectId}/flags/${flagKey}/environments/${env}/overrides`,
      data,
    ),

  delete: (projectId: string, flagKey: string, env: string, id: string) =>
    http.delete(
      `/admin/projects/${projectId}/flags/${flagKey}/environments/${env}/overrides/${id}`,
    ),
}

export const contextFieldsApi = {
  list: (projectId: string) =>
    http.get<ContextField[]>(`/admin/projects/${projectId}/context-fields`),
}

export const projectsApi = {
  list: () => http.get<Project[]>('/admin/projects'),

  get: (id: string) => http.get<Project>(`/admin/projects/${id}`),

  create: (data: { name: string; slug: string; description?: string }) =>
    http.post<Project>('/admin/projects', data),
}
```

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
pnpm --filter @flagraft/admin-ui test -- api
```

Expected: all existing api tests pass. If any test mocks a path like `/api/v1/...`, update it to `/admin/...`.

---

## Task 2: Fix useOverrides to match new API shapes

**Files:**

- Modify: `packages/admin-ui/src/hooks/useOverrides.ts`
- Modify: `packages/admin-ui/src/hooks/__tests__/useOverrides.test.ts`

### Background

`overridesApi.create` and `overridesApi.delete` now require `env` as an explicit argument (it was previously embedded in the data or a query param). `overridesApi.update` no longer exists -- the hook must implement edit by deleting the old record and creating a new one.

- [ ] **Step 1: Replace `useOverrides.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { overridesApi } from '../lib/api'
import type { Override } from '../lib/types'

interface UseOverridesOptions {
  projectId: string
  flagKey: string
  env: string
}

interface UseOverridesResult {
  overrides: Override[]
  loading: boolean
  error: string | null
  createOverride: (data: Omit<Override, 'id' | 'flag' | 'env' | 'created'>) => Promise<void>
  updateOverride: (
    id: string,
    data: Omit<Override, 'id' | 'flag' | 'env' | 'created'>,
  ) => Promise<void>
  deleteOverride: (id: string) => Promise<void>
  refetch: () => void
}

export function useOverrides({ projectId, flagKey, env }: UseOverridesOptions): UseOverridesResult {
  const [overrides, setOverrides] = useState<Override[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    overridesApi
      .list(projectId, flagKey, env)
      .then((res) => {
        if (!cancelled) {
          setOverrides(res.data)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setOverrides([])
          setError(err.message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId, flagKey, env, tick])

  const refetch = useCallback(() => setTick((n) => n + 1), [])

  const createOverride = useCallback(
    async (data: Omit<Override, 'id' | 'flag' | 'env' | 'created'>) => {
      await overridesApi.create(projectId, flagKey, env, data)
      refetch()
    },
    [projectId, flagKey, env, refetch],
  )

  /**
   * The backend has no PATCH override route.
   * Edit is implemented as delete + create so the override gets a new ID.
   */
  const updateOverride = useCallback(
    async (id: string, data: Omit<Override, 'id' | 'flag' | 'env' | 'created'>) => {
      await overridesApi.delete(projectId, flagKey, env, id)
      await overridesApi.create(projectId, flagKey, env, data)
      refetch()
    },
    [projectId, flagKey, env, refetch],
  )

  const deleteOverride = useCallback(
    async (id: string) => {
      await overridesApi.delete(projectId, flagKey, env, id)
      refetch()
    },
    [projectId, flagKey, env, refetch],
  )

  return { overrides, loading, error, createOverride, updateOverride, deleteOverride, refetch }
}
```

- [ ] **Step 2: Update `useOverrides.test.ts`**

Read the existing test file. Update any mocks that reference `overridesApi.update` or `overridesApi.reorder` (these no longer exist). Add a test for `updateOverride` calling `delete` then `create`:

```typescript
it('updateOverride calls delete then create', async () => {
  vi.mocked(overridesApi.delete).mockResolvedValue({} as any)
  vi.mocked(overridesApi.create).mockResolvedValue({ data: mockOverride } as any)

  const { result } = renderHook(() =>
    useOverrides({ projectId: 'p1', flagKey: 'flag-a', env: 'development' }),
  )

  await act(async () => {
    await result.current.updateOverride('override-id', {
      key: 'userId',
      op: 'equals',
      val: '42',
      result: true,
      note: '',
    })
  })

  expect(overridesApi.delete).toHaveBeenCalledWith('p1', 'flag-a', 'development', 'override-id')
  expect(overridesApi.create).toHaveBeenCalledWith('p1', 'flag-a', 'development', {
    key: 'userId',
    op: 'equals',
    val: '42',
    result: true,
    note: '',
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @flagraft/admin-ui test -- useOverrides
```

Expected: all tests pass.

---

## Task 3: Wire MainLayout to real ProjectContext

**Files:**

- Modify: `packages/admin-ui/src/components/layout/MainLayout.tsx`
- Modify: `packages/admin-ui/src/components/layout/__tests__/MainLayout.test.tsx`

### Background

`MainLayout` currently ignores `ProjectContext` and uses a hardcoded `PLACEHOLDER_PROJECT`. It needs to use the real `useProject()` hook. The `onSwitchProject` handler currently does nothing -- wire it to open a `ProjectSwitcherModal` (built in Task 4).

- [ ] **Step 1: Replace `MainLayout.tsx`**

```typescript
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { SideNav } from './SideNav'
import { ShortcutsHelpModal } from './ShortcutsHelpModal'
import { ProjectSwitcherModal } from './ProjectSwitcherModal'
import { useProject } from '../../contexts/ProjectContext'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import type { EnvSlug } from './TopBar'
import type { NavItemId } from './SideNav'

export interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { activeProject, activeEnv, setActiveEnv } = useProject()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)

  const current = (pathname.split('/')[1] || 'flags') as NavItemId

  function focusSearch() {
    const input = document.querySelector<HTMLInputElement>('.topbar-search input')
    input?.focus()
  }

  useKeyboardShortcuts({
    '/': focusSearch,
    'cmd+k': focusSearch,
    '?': () => setShowShortcuts(true),
    Escape: () => {
      if (showShortcuts) setShowShortcuts(false)
    },
  })

  const project = activeProject ?? { id: '', name: 'No project', slug: '' }

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="app-shell">
        <TopBar
          project={project}
          onSwitchProject={() => setShowSwitcher(true)}
          activeEnv={(activeEnv as EnvSlug) ?? 'development'}
          onChangeEnv={setActiveEnv}
          onOpenSearch={focusSearch}
          onShowHelp={() => setShowShortcuts(true)}
        />
        <SideNav current={current} onNav={(id) => navigate(`/${id}`)} />
        <main className="main" id="main-content">{children}</main>
      </div>
      <ShortcutsHelpModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <ProjectSwitcherModal open={showSwitcher} onClose={() => setShowSwitcher(false)} />
    </>
  )
}
```

- [ ] **Step 2: Update `MainLayout.test.tsx`**

The test currently mocks `TopBar` or renders the full tree. Update any test that references `PLACEHOLDER_PROJECT` or `Flagraft Demo`. Add a mock for `useProject`:

```typescript
vi.mock('../../contexts/ProjectContext', () => ({
  useProject: () => ({
    activeProject: { id: 'p1', name: 'Demo', slug: 'demo', flagCount: 0 },
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    projects: [],
    loading: false,
    error: null,
  }),
}))
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @flagraft/admin-ui test -- MainLayout
```

Expected: all tests pass.

---

## Task 4: API key input in SettingsScreen

**Files:**

- Modify: `packages/admin-ui/src/components/screens/SettingsScreen.tsx`
- Modify: `packages/admin-ui/src/components/screens/__tests__/SettingsScreen.test.tsx`

### Background

The axios interceptor already reads `flagraft_api_key` from `localStorage` on every request. The only missing piece is a UI to set it. Add a section in `SettingsScreen` with a password input and a save button.

- [ ] **Step 1: Add API key section to `SettingsScreen.tsx`**

Add a new state and section **below** the existing Environments section and **above** the Danger Zone:

```typescript
// Add to imports at top:
import { useState } from 'react'
import { Button } from '../primitives/Button'
import { TextField } from '../primitives/TextField'

// Add inside SettingsScreen function, before the return:
const [apiKey, setApiKey] = useState(() => localStorage.getItem('flagraft_api_key') ?? '')
const [saved, setSaved] = useState(false)

function handleSaveKey() {
  if (apiKey.trim()) {
    localStorage.setItem('flagraft_api_key', apiKey.trim())
  } else {
    localStorage.removeItem('flagraft_api_key')
  }
  setSaved(true)
  setTimeout(() => setSaved(false), 2000)
}
```

Add the section JSX between Environments and Danger Zone:

```tsx
<section className="settings-section">
  <h2 className="settings-section-title">API Key</h2>
  <p className="settings-danger-desc">
    Your admin API key is stored locally in this browser. It is sent with every request.
  </p>
  <div className="settings-api-key-row">
    <TextField
      label="Admin API key"
      type="password"
      value={apiKey}
      onChange={setApiKey}
      placeholder="Enter your admin API key"
    />
    <Button variant="primary" size="sm" onClick={handleSaveKey}>
      {saved ? 'Saved' : 'Save'}
    </Button>
  </div>
</section>
```

Add CSS to `src/styles/index.css`:

```css
.settings-api-key-row {
  display: flex;
  align-items: flex-end;
  gap: var(--s-3);
}

.settings-api-key-row > *:first-child {
  flex: 1;
}
```

- [ ] **Step 2: Add tests to `SettingsScreen.test.tsx`**

Add a `describe('API key section')` block:

```typescript
it('renders API key input', () => {
  vi.mocked(useProject).mockReturnValue(mockProjectCtx)
  render(<SettingsScreen />)
  expect(screen.getByLabelText(/api key/i)).toBeInTheDocument()
})

it('saves key to localStorage on Save click', async () => {
  vi.mocked(useProject).mockReturnValue(mockProjectCtx)
  render(<SettingsScreen />)
  const input = screen.getByLabelText(/api key/i)
  fireEvent.change(input, { target: { value: 'my-secret-key' } })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(localStorage.getItem('flagraft_api_key')).toBe('my-secret-key')
})

it('removes key from localStorage when saved empty', async () => {
  localStorage.setItem('flagraft_api_key', 'existing-key')
  vi.mocked(useProject).mockReturnValue(mockProjectCtx)
  render(<SettingsScreen />)
  const input = screen.getByLabelText(/api key/i)
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(localStorage.getItem('flagraft_api_key')).toBeNull()
})
```

Note: check how `useProject` is mocked in the existing test file and define `mockProjectCtx` accordingly.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @flagraft/admin-ui test -- SettingsScreen
```

Expected: all tests pass including 3 new API key tests.

---

## Task 5: ProjectSwitcherModal and CreateProjectModal

**Files:**

- Create: `packages/admin-ui/src/components/layout/ProjectSwitcherModal.tsx`
- Create: `packages/admin-ui/src/components/layout/CreateProjectModal.tsx`
- Create: `packages/admin-ui/src/components/layout/__tests__/ProjectSwitcherModal.test.tsx`
- Create: `packages/admin-ui/src/components/layout/__tests__/CreateProjectModal.test.tsx`

### Background

`ProjectSwitcherModal` lists all projects from context, lets the user click to switch, and has a "+ New Project" button that opens `CreateProjectModal`. Project creation calls `projectsApi.create()` which requires a root admin key (not a regular admin key). The backend returns `403` if a non-root key is used -- surface this as an error toast.

- [ ] **Step 1: Write tests first for ProjectSwitcherModal**

Create `packages/admin-ui/src/components/layout/__tests__/ProjectSwitcherModal.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProjectSwitcherModal } from '../ProjectSwitcherModal'
import { ThemeProvider } from '../../../contexts/ThemeContext'
import { ToastProvider } from '../../../contexts/ToastContext'
import React from 'react'

const mockSetActiveProject = vi.fn()

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projects: [
      { id: 'p1', name: 'Alpha', slug: 'alpha', flagCount: 3 },
      { id: 'p2', name: 'Beta', slug: 'beta', flagCount: 7 },
    ],
    activeProject: { id: 'p1', name: 'Alpha', slug: 'alpha', flagCount: 3 },
    setActiveProject: mockSetActiveProject,
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    loading: false,
    error: null,
  }),
}))

function renderModal(open = true) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <ProjectSwitcherModal open={open} onClose={vi.fn()} />
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe('ProjectSwitcherModal', () => {
  it('renders project list when open', () => {
    renderModal()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderModal(false)
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })

  it('calls setActiveProject and onClose when a project is clicked', () => {
    const onClose = vi.fn()
    render(
      <ThemeProvider>
        <ToastProvider>
          <ProjectSwitcherModal open onClose={onClose} />
        </ToastProvider>
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByText('Beta'))
    expect(mockSetActiveProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p2' }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('shows new project button', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @flagraft/admin-ui test -- ProjectSwitcherModal 2>&1 | grep -E "FAIL|PASS"
```

Expected: FAIL (component not found).

- [ ] **Step 3: Implement ProjectSwitcherModal**

Create `packages/admin-ui/src/components/layout/ProjectSwitcherModal.tsx`:

```typescript
import { useState } from 'react'
import { Modal } from '../primitives/Modal'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import { useProject } from '../../contexts/ProjectContext'
import { CreateProjectModal } from './CreateProjectModal'
import type { Project } from '../../lib/types'

interface ProjectSwitcherModalProps {
  open: boolean
  onClose: () => void
}

/** Lists available projects and lets the user switch or create one. */
export function ProjectSwitcherModal({ open, onClose }: ProjectSwitcherModalProps) {
  const { projects, activeProject, setActiveProject } = useProject()
  const [showCreate, setShowCreate] = useState(false)

  function handleSelect(project: Project) {
    setActiveProject(project)
    onClose()
  }

  return (
    <>
      <Modal open={open} onClose={onClose} titleId="switcher-modal-title">
        <Modal.Header id="switcher-modal-title">Switch project</Modal.Header>
        <Modal.Body>
          <div className="project-list">
            {projects.map((p) => (
              <button
                key={p.id}
                className={`project-list-item${activeProject?.id === p.id ? ' project-list-item--active' : ''}`}
                onClick={() => handleSelect(p)}
              >
                <span className="project-list-name">{p.name}</span>
                <span className="project-list-slug mono">/{p.slug}</span>
                {activeProject?.id === p.id && <Icon name="check" size={14} />}
              </button>
            ))}
            {projects.length === 0 && (
              <p className="project-list-empty">No projects found.</p>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" size="sm" leftIcon="plus" onClick={() => setShowCreate(true)}>
            New project
          </Button>
        </Modal.Footer>
      </Modal>
      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(project) => {
          setActiveProject(project)
          setShowCreate(false)
          onClose()
        }}
      />
    </>
  )
}
```

Add CSS to `src/styles/index.css`:

```css
.project-list {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
}

.project-list-item {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-elev);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.1s;
}

.project-list-item:hover {
  background: var(--bg-hover);
}

.project-list-item--active {
  border-color: var(--pri);
  background: var(--pri-soft);
}

.project-list-name {
  font-weight: 500;
  color: var(--text-1);
  flex: 1;
}

.project-list-slug {
  color: var(--text-3);
  font-size: 12px;
}

.project-list-empty {
  color: var(--text-3);
  font-size: 14px;
  text-align: center;
  padding: var(--s-6) 0;
}
```

- [ ] **Step 4: Write tests for CreateProjectModal**

Create `packages/admin-ui/src/components/layout/__tests__/CreateProjectModal.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateProjectModal } from '../CreateProjectModal'
import { ThemeProvider } from '../../../contexts/ThemeContext'
import { ToastProvider } from '../../../contexts/ToastContext'

vi.mock('../../../lib/api', () => ({
  projectsApi: {
    create: vi.fn(),
  },
}))

import { projectsApi } from '../../../lib/api'

function renderModal(onCreated = vi.fn(), onClose = vi.fn()) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <CreateProjectModal open onClose={onClose} onCreated={onCreated} />
      </ToastProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('CreateProjectModal', () => {
  it('renders name and slug fields', () => {
    renderModal()
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /slug/i })).toBeInTheDocument()
  })

  it('auto-derives slug from name', () => {
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'My Cool Project' },
    })
    expect(screen.getByRole('textbox', { name: /slug/i })).toHaveValue('my-cool-project')
  })

  it('calls projectsApi.create and onCreated on submit', async () => {
    const created = { id: 'p3', name: 'New', slug: 'new', flagCount: 0 }
    vi.mocked(projectsApi.create).mockResolvedValue({ data: created } as any)
    const onCreated = vi.fn()
    renderModal(onCreated)

    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'New' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    await waitFor(() => {
      expect(projectsApi.create).toHaveBeenCalledWith({ name: 'New', slug: 'new' })
      expect(onCreated).toHaveBeenCalledWith(created)
    })
  })

  it('shows error toast on 403 (root key required)', async () => {
    vi.mocked(projectsApi.create).mockRejectedValue(
      Object.assign(new Error('Forbidden'), { response: { status: 403 } }),
    )
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'Test' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('disables Create button when name is empty', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /create project/i })).toBeDisabled()
  })
})
```

- [ ] **Step 5: Implement CreateProjectModal**

Create `packages/admin-ui/src/components/layout/CreateProjectModal.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Modal } from '../primitives/Modal'
import { Button } from '../primitives/Button'
import { TextField } from '../primitives/TextField'
import { useToast } from '../../hooks/useToast'
import { projectsApi } from '../../lib/api'
import type { Project } from '../../lib/types'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onCreated: (project: Project) => void
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Modal form for creating a new project. Requires a root admin API key. */
export function CreateProjectModal({ open, onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setName('')
      setSlug('')
      setSlugManual(false)
    }
  }, [open])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManual) setSlug(toSlug(value))
  }

  function handleSlugChange(value: string) {
    setSlug(value)
    setSlugManual(true)
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const res = await projectsApi.create({ name: name.trim(), slug: slug.trim() })
      toast.push({ title: 'Project created', variant: 'success' })
      onCreated(res.data)
    } catch (err: unknown) {
      const isAxios = typeof err === 'object' && err !== null && 'response' in err
      const status = isAxios ? (err as { response: { status: number } }).response.status : 0
      const message =
        status === 403
          ? 'Project creation requires a root admin key.'
          : err instanceof Error
          ? err.message
          : 'Failed to create project'
      toast.push({ title: message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} titleId="create-project-modal-title">
      <Modal.Header id="create-project-modal-title">New project</Modal.Header>
      <Modal.Body>
        <TextField label="Name" value={name} onChange={handleNameChange} placeholder="My project" />
        <TextField
          label="Slug"
          value={slug}
          onChange={handleSlugChange}
          placeholder="my-project"
          hint="Used in API paths. Lowercase letters, numbers, hyphens."
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!name.trim() || !slug.trim() || saving}
          onClick={() => void handleCreate()}
        >
          {saving ? 'Creating...' : 'Create project'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
pnpm --filter @flagraft/admin-ui test -- ProjectSwitcherModal CreateProjectModal
```

Expected: all tests pass.

---

## Task 6: Create Flag modal and wire New Flag button

**Files:**

- Create: `packages/admin-ui/src/components/screens/CreateFlagModal.tsx`
- Create: `packages/admin-ui/src/components/screens/__tests__/CreateFlagModal.test.tsx`
- Modify: `packages/admin-ui/src/components/screens/FlagsScreen.tsx`
- Modify: `packages/admin-ui/src/components/screens/__tests__/FlagsScreen.test.tsx`

### Background

The "New Flag" button in `FlagsScreen` renders but has no action. The flag `key` must be a valid kebab-case identifier (letters, numbers, hyphens). Auto-derive it from the name but allow manual override. On success, navigate to the new flag detail page.

- [ ] **Step 1: Write tests for CreateFlagModal**

Create `packages/admin-ui/src/components/screens/__tests__/CreateFlagModal.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CreateFlagModal } from '../CreateFlagModal'
import { ThemeProvider } from '../../../contexts/ThemeContext'
import { ToastProvider } from '../../../contexts/ToastContext'

vi.mock('../../../lib/api', () => ({
  flagsApi: { create: vi.fn() },
}))

import { flagsApi } from '../../../lib/api'

function renderModal(onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <ToastProvider>
          <CreateFlagModal open projectId="p1" onClose={onClose} />
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('CreateFlagModal', () => {
  it('renders name, key and description fields', () => {
    renderModal()
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /key/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument()
  })

  it('auto-derives key from name', () => {
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'My New Feature' },
    })
    expect(screen.getByRole('textbox', { name: /key/i })).toHaveValue('my-new-feature')
  })

  it('Create button is disabled when name is empty', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /create flag/i })).toBeDisabled()
  })

  it('calls flagsApi.create and closes on success', async () => {
    vi.mocked(flagsApi.create).mockResolvedValue({
      data: {
        key: 'my-feature',
        name: 'My Feature',
        description: '',
        tags: [],
        created: '',
        updated: '',
        state: {},
        author: '',
      },
    } as any)
    const onClose = vi.fn()
    renderModal(onClose)

    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'My Feature' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create flag/i }))

    await waitFor(() => {
      expect(flagsApi.create).toHaveBeenCalledWith('p1', {
        name: 'My Feature',
        key: 'my-feature',
        description: '',
      })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows error toast on failure', async () => {
    vi.mocked(flagsApi.create).mockRejectedValue(new Error('Key already exists'))
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'Test' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create flag/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @flagraft/admin-ui test -- CreateFlagModal 2>&1 | grep -E "FAIL|PASS"
```

Expected: FAIL (component not found).

- [ ] **Step 3: Implement CreateFlagModal**

Create `packages/admin-ui/src/components/screens/CreateFlagModal.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../primitives/Modal'
import { Button } from '../primitives/Button'
import { TextField } from '../primitives/TextField'
import { useToast } from '../../hooks/useToast'
import { flagsApi } from '../../lib/api'

interface CreateFlagModalProps {
  open: boolean
  projectId: string
  onClose: () => void
}

function toFlagKey(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Modal form for creating a new feature flag inside a project. */
export function CreateFlagModal({ open, projectId, onClose }: CreateFlagModalProps) {
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyManual, setKeyManual] = useState(false)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setName('')
      setKey('')
      setKeyManual(false)
      setDescription('')
    }
  }, [open])

  function handleNameChange(value: string) {
    setName(value)
    if (!keyManual) setKey(toFlagKey(value))
  }

  function handleKeyChange(value: string) {
    setKey(value)
    setKeyManual(true)
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const res = await flagsApi.create(projectId, {
        name: name.trim(),
        key: key.trim(),
        description: description.trim(),
      })
      toast.push({ title: 'Flag created', variant: 'success' })
      onClose()
      navigate(`/flags/${res.data.key}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create flag'
      toast.push({ title: message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} titleId="create-flag-modal-title">
      <Modal.Header id="create-flag-modal-title">New feature flag</Modal.Header>
      <Modal.Body>
        <TextField label="Name" value={name} onChange={handleNameChange} placeholder="My feature" />
        <TextField
          label="Key"
          value={key}
          onChange={handleKeyChange}
          placeholder="my-feature"
          hint="Unique identifier used in SDK calls. Lowercase letters, numbers, hyphens."
        />
        <TextField
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Optional description"
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!name.trim() || !key.trim() || saving}
          onClick={() => void handleCreate()}
        >
          {saving ? 'Creating...' : 'Create flag'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
```

- [ ] **Step 4: Wire "New Flag" button in FlagsScreen**

In `packages/admin-ui/src/components/screens/FlagsScreen.tsx`:

Add import:

```typescript
import { CreateFlagModal } from './CreateFlagModal'
```

Add state inside `FlagsScreenInner` (after existing state declarations):

```typescript
const [showCreate, setShowCreate] = useState(false)
```

Update the "New Flag" button in the JSX (it currently has no `onClick`):

```tsx
<Button variant="primary" leftIcon="plus" onClick={() => setShowCreate(true)}>
  New Flag
</Button>
```

Add `CreateFlagModal` just before the closing `</div>` of `flags-screen`:

```tsx
<CreateFlagModal open={showCreate} projectId={projectId} onClose={() => setShowCreate(false)} />
```

- [ ] **Step 5: Add a test to FlagsScreen.test.tsx**

In `packages/admin-ui/src/components/screens/__tests__/FlagsScreen.test.tsx`, add one test to confirm the New Flag button opens the modal:

```typescript
it('opens create flag modal when New Flag is clicked', async () => {
  // use whatever mock setup is already in the file for a loaded state
  renderScreen() // or however the test renders FlagsScreen
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /new flag/i })).toBeInTheDocument()
  })
  fireEvent.click(screen.getByRole('button', { name: /new flag/i }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('New feature flag')).toBeInTheDocument()
})
```

- [ ] **Step 6: Run all tests**

```bash
pnpm --filter @flagraft/admin-ui test -- CreateFlagModal FlagsScreen
```

Expected: all tests pass.

- [ ] **Step 7: Full suite check**

```bash
pnpm --filter @flagraft/admin-ui test
```

Expected: all tests pass. Note the current baseline is 317 tests across 40 files.

---

## Success Criteria

1. `pnpm --filter @flagraft/admin-ui test` -- all tests pass, zero failures
2. `pnpm exec tsc --noEmit` in `packages/admin-ui` -- zero TypeScript errors
3. With a real running backend and a valid admin API key set in Settings, the flags list loads from the API
4. With a root admin API key, a new project can be created from the project switcher
5. The "New Flag" button opens a modal, submitting it creates the flag via the API and navigates to its detail screen
6. Override create and delete work against the real backend
7. Override edit (delete + create) works without error
