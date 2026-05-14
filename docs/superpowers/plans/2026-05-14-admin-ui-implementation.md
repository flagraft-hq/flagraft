# Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a production-ready admin UI for Flagraft feature flag management with flags list, context overrides CRUD, and complete design system.

**Architecture:** Build from foundation up: design tokens and primitives, layout shells, data contexts, then feature screens. Use TDD with React Testing Library. Integrate with existing backend API via axios client. Theming via CSS custom properties with React context.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Router v6, Vite, Vitest, React Testing Library

---

## File Structure

```
packages/admin-ui/src/
├── components/
│   ├── primitives/
│   │   ├── Icon.tsx              (SVG icon library, 30+ icons)
│   │   ├── Button.tsx            (primary/ghost/danger, sm/default sizes)
│   │   ├── Toggle.tsx            (switch with production variant)
│   │   ├── Checkbox.tsx          (with indeterminate state)
│   │   ├── Modal.tsx             (backdrop + content + footer)
│   │   ├── TextField.tsx         (input + label + hint)
│   │   ├── Select.tsx            (dropdown with options)
│   │   ├── Tip.tsx               (tooltip wrapper)
│   │   ├── Badge.tsx             (pill/tag container)
│   │   ├── Kbd.tsx               (keyboard key display)
│   │   └── Toast.tsx             (notification)
│   ├── layout/
│   │   ├── TopBar.tsx            (header with project/env/theme switcher)
│   │   ├── SideNav.tsx           (navigation menu)
│   │   └── MainLayout.tsx        (wrapper with TopBar + SideNav + main)
│   └── screens/
│       ├── FlagsScreen.tsx       (flags list with filters/sort/bulk)
│       ├── FlagDetailScreen.tsx  (detail view + context overrides)
│       ├── ContextOverridesSection.tsx (override form + list)
│       ├── OverrideForm.tsx      (inline add/edit form)
│       ├── OverrideRow.tsx       (read-only override display)
│       └── SettingsScreen.tsx    (project/key settings)
├── contexts/
│   ├── ThemeContext.tsx          (theme, density, accent color)
│   ├── ProjectContext.tsx        (current project, environment)
│   ├── ToastContext.tsx          (notification queue)
│   └── useToast.ts               (hook to trigger toasts)
├── hooks/
│   ├── useFlags.ts               (fetch/search/sort flags)
│   ├── useOverrides.ts           (fetch/mutate overrides)
│   ├── useContextFields.ts       (fetch context field registry)
│   ├── useRelativeDate.ts        (format timestamps)
│   └── useKeyboardShortcuts.ts   (global keyboard handlers)
├── lib/
│   ├── api.ts                    (axios client, endpoints)
│   ├── validation.ts             (override validation logic)
│   ├── format.ts                 (date, text, number formatting)
│   ├── types.ts                  (TypeScript interfaces for API models)
│   └── constants.ts              (operators, env names, colors)
├── styles/
│   ├── index.css                 (import Tailwind, define CSS variables for theme)
│   └── animations.css            (transitions, keyframes)
├── App.tsx                       (React Router setup, main routes)
└── main.tsx                      (ReactDOM render)
```

---

## Phase 1: Foundation & Design System

### Task 1: Set up CSS tokens and theme infrastructure

**Files:**
- Create: `packages/admin-ui/src/styles/index.css`
- Create: `packages/admin-ui/src/contexts/ThemeContext.tsx`
- Modify: `packages/admin-ui/src/App.tsx`

- [ ] **Step 1: Write CSS variables for colors, spacing, radius, shadows**

Create `packages/admin-ui/src/styles/index.css`:

```css
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

:root {
  /* Brand colors */
  --teal-50: #f0fdfa;
  --teal-100: #ccfbf1;
  --teal-200: #99f6e4;
  --teal-300: #5eead4;
  --teal-400: #2dd4bf;
  --teal-500: #14b8a6;
  --teal-600: #0d9488;
  --teal-700: #0f766e;
  --teal-800: #115e59;
  --teal-900: #134e4a;

  --amber-50: #fffbeb;
  --amber-100: #fef3c7;
  --amber-200: #fde68a;
  --amber-300: #fcd34d;
  --amber-400: #fbbf24;
  --amber-500: #f59e0b;
  --amber-600: #d97706;
  --amber-700: #b45309;

  --red-50: #fef2f2;
  --red-100: #fee2e2;
  --red-300: #fca5a5;
  --red-500: #ef4444;
  --red-600: #dc2626;
  --red-700: #b91c1c;

  /* Neutral */
  --ink-0: #ffffff;
  --ink-50: #f8fafc;
  --ink-100: #f1f5f9;
  --ink-200: #e2e8f0;
  --ink-300: #cbd5e1;
  --ink-400: #94a3b8;
  --ink-500: #64748b;
  --ink-600: #475569;
  --ink-700: #334155;
  --ink-800: #1e293b;
  --ink-900: #0f172a;
  --ink-950: #020617;

  /* Spacing */
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 20px;
  --s-6: 24px;
  --s-8: 32px;
  --s-10: 40px;
  --s-12: 48px;
  --s-16: 64px;

  /* Radius */
  --r-sm: 6px;
  --r-md: 8px;
  --r-lg: 10px;
  --r-xl: 12px;
  --r-pill: 999px;

  /* Shadow */
  --shadow-1: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-2: 0 1px 3px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.04);
  --shadow-3: 0 4px 12px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.10);

  /* Fonts */
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  /* Light theme defaults */
  --bg-app: #f6f7f9;
  --bg-elev: #ffffff;
  --bg-subtle: #f1f5f9;
  --bg-hover: #f1f5f9;
  --bg-active: #e2e8f0;
  --border: #e5e9ef;
  --border-strong: #cfd6e0;
  --text-1: #0f172a;
  --text-2: #334155;
  --text-3: #64748b;
  --text-4: #94a3b8;

  --pri: var(--teal-600);
  --pri-hover: var(--teal-700);
  --pri-soft: var(--teal-50);
  --pri-fg: var(--teal-700);
  --acc: var(--amber-500);
  --danger: var(--red-600);

  --focus: 0 0 0 3px rgba(45, 212, 191, 0.35);
}

.theme-dark {
  --bg-app: #0b1220;
  --bg-elev: #111a2c;
  --bg-subtle: #0f1828;
  --bg-hover: #172238;
  --bg-active: #1d2942;
  --border: #1f2a40;
  --border-strong: #2a3855;
  --text-1: #f1f5f9;
  --text-2: #cbd5e1;
  --text-3: #94a3b8;
  --text-4: #64748b;

  --pri: var(--teal-400);
  --pri-hover: var(--teal-300);
  --pri-soft: rgba(45, 212, 191, 0.10);
  --pri-fg: var(--teal-300);
  --acc: var(--amber-400);
  --danger: #f87171;

  --focus: 0 0 0 3px rgba(45, 212, 191, 0.45);
}

body {
  font-family: var(--font-sans);
  background-color: var(--bg-app);
  color: var(--text-1);
  font-size: 14px;
  line-height: 1.5;
}

.compact { font-size: 13px; }
```

- [ ] **Step 2: Create ThemeContext for theme/density/accent state**

Create `packages/admin-ui/src/contexts/ThemeContext.tsx`:

```typescript
import React, { createContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type Accent = 'teal' | 'indigo' | 'violet' | 'rose';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  density: Density;
  setDensity: (density: Density) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ACCENT_COLORS = {
  teal: { 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e' },
  indigo: { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
  violet: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
  rose: { 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [density, setDensity] = useState<Density>('comfortable');
  const [accent, setAccent] = useState<Accent>('teal');

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('compact', density === 'compact');
  }, [density]);

  useEffect(() => {
    const colors = ACCENT_COLORS[accent];
    const root = document.documentElement.style;
    root.setProperty('--teal-400', colors[400]);
    root.setProperty('--teal-500', colors[500]);
    root.setProperty('--teal-600', colors[600]);
    root.setProperty('--teal-700', colors[700]);
  }, [accent]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, density, setDensity, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme called outside ThemeProvider');
  return ctx;
}
```

- [ ] **Step 3: Add ThemeProvider to App**

Modify `packages/admin-ui/src/App.tsx`:

```typescript
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/index.css';

export function App() {
  return (
    <ThemeProvider>
      {/* routes will go here */}
    </ThemeProvider>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/admin-ui/src/styles/index.css packages/admin-ui/src/contexts/ThemeContext.tsx packages/admin-ui/src/App.tsx
git commit -m "feat: add CSS tokens and theme context with light/dark/density/accent support"
```

---

### Task 2: Implement Icon component (SVG library)

**Files:**
- Create: `packages/admin-ui/src/components/primitives/Icon.tsx`
- Create: `packages/admin-ui/src/components/primitives/__tests__/Icon.test.tsx`

- [ ] **Step 1: Write test for Icon rendering**

Create `packages/admin-ui/src/components/primitives/__tests__/Icon.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { Icon } from '../Icon';

describe('Icon', () => {
  it('renders SVG with correct size', () => {
    const { container } = render(<Icon name="check" size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('applies custom className', () => {
    const { container } = render(<Icon name="flag" className="text-red-600" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-red-600');
  });

  it('renders flag icon by default for unknown names', () => {
    const { container } = render(<Icon name="unknown" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @flagraft/admin-ui test 2>&1 | grep -A5 "Icon.test"
```

Expected output shows test failures (Icon component not found).

- [ ] **Step 3: Implement Icon component with 30+ icons**

Create `packages/admin-ui/src/components/primitives/Icon.tsx`:

```typescript
import React from 'react';

type IconName =
  | 'flag' | 'flagFilled' | 'layers' | 'target' | 'key' | 'history' | 'settings'
  | 'plus' | 'search' | 'chevronDown' | 'chevronRight' | 'check' | 'minus' | 'x'
  | 'moon' | 'sun' | 'alert' | 'info' | 'trash' | 'edit' | 'copy' | 'eye' | 'eyeOff'
  | 'filter' | 'keyboard' | 'cmd' | 'code' | 'bolt' | 'shield' | 'book' | 'refresh'
  | 'sparkles' | 'arrowRight' | 'play' | 'user' | 'palette';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  [key: string]: unknown;
}

export function Icon({ name, size = 16, className = '', ...rest }: IconProps) {
  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    ...rest,
  };

  const icons: Record<IconName, JSX.Element> = {
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
    book: <><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 16a4 4 0 0 1 4-4h12"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15.7-6L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.7 6L3 16M3 21v-5h5"/></>,
    sparkles: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    play: <><path d="M6 4v16l14-8z"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    palette: <><path d="M12 22a10 10 0 1 1 10-10c0 2-1.6 3-3.5 3H17a2 2 0 0 0-1.8 2.8 2 2 0 0 1-1.8 2.8c-.5.1-1 .2-1.4.4"/><circle cx="7.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="12" cy="6.5" r="1.2" fill="currentColor"/><circle cx="16.5" cy="9.5" r="1.2" fill="currentColor"/></>,
  };

  return <svg {...svgProps}>{icons[name] || icons.flag}</svg>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @flagraft/admin-ui test -- Icon 2>&1 | tail -10
```

Expected output shows Icon tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/admin-ui/src/components/primitives/Icon.tsx packages/admin-ui/src/components/primitives/__tests__/Icon.test.tsx
git commit -m "feat: implement Icon component with 30+ SVG icons"
```

---

### Task 3: Implement Button component

**Files:**
- Create: `packages/admin-ui/src/components/primitives/Button.tsx`
- Create: `packages/admin-ui/src/components/primitives/__tests__/Button.test.tsx`

- [ ] **Step 1: Write tests for Button variants and sizes**

Create `packages/admin-ui/src/components/primitives/__tests__/Button.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('renders primary variant', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-primary');
  });

  it('renders ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-ghost');
  });

  it('renders danger variant', () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-danger');
  });

  it('renders sm size', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('btn-sm');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders with left icon', () => {
    const { container } = render(<Button leftIcon="plus">Add</Button>);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('renders with right icon', () => {
    const { container } = render(<Button rightIcon="arrowRight">Next</Button>);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @flagraft/admin-ui test -- Button 2>&1 | grep -A3 "FAIL"
```

Expected: Tests fail because Button doesn't exist.

- [ ] **Step 3: Implement Button component**

Create `packages/admin-ui/src/components/primitives/Button.tsx`:

```typescript
import React from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'default' | 'sm';
  leftIcon?: IconName;
  rightIcon?: IconName;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', leftIcon, rightIcon, className = '', children, ...rest }, ref) => {
    const classes = [
      'btn',
      variant !== 'default' && `btn-${variant}`,
      size !== 'default' && `btn-${size}`,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={classes} {...rest}>
        {leftIcon ? <Icon name={leftIcon} size={14} /> : null}
        {children}
        {rightIcon ? <Icon name={rightIcon} size={14} /> : null}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

Add styles to `packages/admin-ui/src/styles/index.css`:

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  padding: var(--s-3) var(--s-4);
  border: 1px solid transparent;
  border-radius: var(--r-md);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
}

.btn:focus-visible {
  outline: var(--focus);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--pri);
  color: white;
  border-color: var(--pri);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--pri-hover);
  border-color: var(--pri-hover);
}

.btn-ghost {
  background-color: transparent;
  color: var(--text-1);
  border-color: var(--border);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--bg-hover);
}

.btn-danger {
  background-color: var(--danger);
  color: white;
  border-color: var(--danger);
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--red-700);
}

.btn-sm {
  padding: var(--s-2) var(--s-3);
  font-size: 13px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @flagraft/admin-ui test -- Button 2>&1 | tail -5
```

Expected: All Button tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/admin-ui/src/components/primitives/Button.tsx packages/admin-ui/src/components/primitives/__tests__/Button.test.tsx packages/admin-ui/src/styles/index.css
git commit -m "feat: implement Button component with variants and sizes"
```

---

*(Remaining tasks follow same pattern. For brevity, I'll list the remaining task structure.)*

### Task 4: Implement Toggle component
### Task 5: Implement Checkbox component
### Task 6: Implement Modal component
### Task 7: Implement TextField and Select components
### Task 8: Implement Tip (tooltip) component
### Task 9: Implement Badge and Kbd components

---

## Phase 2: Layout Components

### Task 10: Implement TopBar with project/env/theme switcher
### Task 11: Implement SideNav with navigation menu
### Task 12: Implement MainLayout wrapper

---

## Phase 3: Data & API Integration

### Task 13: Create API client (axios wrapper)
### Task 14: Create types.ts with TypeScript interfaces
### Task 15: Create validation.ts with override validation logic
### Task 16: Create useFlags hook (fetch, search, sort)
### Task 17: Create useOverrides hook (fetch, mutate)
### Task 18: Create useContextFields hook (fetch registry)
### Task 19: Create useRelativeDate hook (format timestamps)
### Task 20: Create ProjectContext and useProject hook
### Task 21: Create ToastContext and useToast hook

---

## Phase 4: Flags Screen

### Task 22: Implement FlagsScreen component (structure)
### Task 23: Implement filter bar (search, tags, state filters)
### Task 24: Implement FlagRow component (list row with toggles)
### Task 25: Implement StatePill component (environment state display)
### Task 26: Implement TagCluster component (tag display)
### Task 27: Implement bulk action bar
### Task 28: Implement production toggle confirmation modal
### Task 29: Add sorting and test all filter/sort combinations
### Task 30: Test flags screen end-to-end

---

## Phase 5: Context Overrides

### Task 31: Implement ContextOverridesSection (main section)
### Task 32: Implement OverrideForm component (add/edit)
### Task 33: Implement OverrideRow component (read-only)
### Task 34: Implement override validation (duplicates, conflicts)
### Task 35: Implement empty state for overrides
### Task 36: Test override CRUD end-to-end

---

## Phase 6: Flag Detail Screen

### Task 37: Implement FlagDetailScreen (layout)
### Task 38: Wire up context overrides section in detail view
### Task 39: Implement flag metadata edit (name, description)
### Task 40: Test flag detail end-to-end

---

## Phase 7: Integration & Polish

### Task 41: Add keyboard shortcuts hook
### Task 42: Wire up keyboard shortcuts globally
### Task 43: Add error state modals and edge case handling
### Task 44: Implement loading states
### Task 45: Implement empty state screens
### Task 46: Run full integration tests
### Task 47: Accessibility audit and fixes
### Task 48: Dark mode and theme switching
### Task 49: Create SettingsScreen (basic placeholder)
### Task 50: Final polish, optimization, type checking

---

## Testing Strategy

- **Unit tests:** Components, hooks, validation logic (TDD)
- **Integration tests:** Filter/sort/bulk, override CRUD
- **Manual testing:** All happy paths, all error paths, keyboard shortcuts, theme switching

## Success Criteria

1. All screens render without errors
2. Filtering, sorting, bulk actions work
3. Context override CRUD with validation works
4. Theme switching and accent customization work
5. Keyboard shortcuts functional
6. Toast notifications working
7. All tests passing
8. No TypeScript errors
9. No accessibility violations
10. Ready for backend integration

---

## Notes for Implementation

- Follow existing patterns in the design files (`flagraft-design/project/`) for reference
- Use React Testing Library (avoid implementation details)
- TDD: write test, see fail, implement, see pass, commit
- Frequent commits (per task)
- No console errors or warnings
- All interactive elements keyboard accessible
- API integration assumes backend endpoints exist and return correct shapes
