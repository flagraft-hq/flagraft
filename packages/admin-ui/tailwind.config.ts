import type { Config } from 'tailwindcss'

/**
 * The design system lives in CSS custom properties (see src/styles/base.css).
 * This config maps Tailwind's theme onto those tokens via `var(--…)` so utility
 * classes (e.g. `bg-surface`, `text-text-2`, `border-line`, `text-pri`) resolve
 * to the same values as the hand-written CSS — and automatically follow the
 * light/dark theme, since the variables are redefined under `.theme-dark`.
 *
 * Note: because colors are `var()` references, Tailwind opacity modifiers
 * (e.g. `bg-pri/50`) are not supported — use the pre-defined `*-soft` tokens
 * instead, exactly as the design system does.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',

      /* Brand / neutral ramps (fixed, not theme-dependent) */
      teal: {
        50: 'var(--teal-50)',
        100: 'var(--teal-100)',
        200: 'var(--teal-200)',
        300: 'var(--teal-300)',
        400: 'var(--teal-400)',
        500: 'var(--teal-500)',
        600: 'var(--teal-600)',
        700: 'var(--teal-700)',
        800: 'var(--teal-800)',
        900: 'var(--teal-900)',
      },
      amber: {
        50: 'var(--amber-50)',
        100: 'var(--amber-100)',
        200: 'var(--amber-200)',
        300: 'var(--amber-300)',
        400: 'var(--amber-400)',
        500: 'var(--amber-500)',
        600: 'var(--amber-600)',
        700: 'var(--amber-700)',
      },
      red: {
        50: 'var(--red-50)',
        100: 'var(--red-100)',
        300: 'var(--red-300)',
        500: 'var(--red-500)',
        600: 'var(--red-600)',
        700: 'var(--red-700)',
      },
      ink: {
        0: 'var(--ink-0)',
        50: 'var(--ink-50)',
        100: 'var(--ink-100)',
        200: 'var(--ink-200)',
        300: 'var(--ink-300)',
        400: 'var(--ink-400)',
        500: 'var(--ink-500)',
        600: 'var(--ink-600)',
        700: 'var(--ink-700)',
        800: 'var(--ink-800)',
        900: 'var(--ink-900)',
        950: 'var(--ink-950)',
      },

      /* Semantic, theme-aware tokens */
      pri: {
        DEFAULT: 'var(--pri)',
        hover: 'var(--pri-hover)',
        soft: 'var(--pri-soft)',
        'soft-border': 'var(--pri-soft-border)',
        fg: 'var(--pri-fg)',
      },
      acc: {
        DEFAULT: 'var(--acc)',
        soft: 'var(--acc-soft)',
        'soft-border': 'var(--acc-soft-border)',
        fg: 'var(--acc-fg)',
      },
      danger: {
        DEFAULT: 'var(--danger)',
        soft: 'var(--danger-soft)',
        'soft-border': 'var(--danger-soft-border)',
        fg: 'var(--danger-fg)',
      },
      surface: {
        DEFAULT: 'var(--bg-elev)',
        app: 'var(--bg-app)',
        subtle: 'var(--bg-subtle)',
        muted: 'var(--bg-muted)',
        hover: 'var(--bg-hover)',
        active: 'var(--bg-active)',
      },
      text: {
        1: 'var(--text-1)',
        2: 'var(--text-2)',
        3: 'var(--text-3)',
        4: 'var(--text-4)',
        inv: 'var(--inv-text)',
      },
      line: {
        DEFAULT: 'var(--border)',
        strong: 'var(--border-strong)',
      },
    },
    extend: {
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r-md)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow-2)',
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
        focus: 'var(--focus)',
      },
    },
  },
  plugins: [],
}

export default config
