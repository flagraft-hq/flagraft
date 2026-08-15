import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ThemeProvider, useTheme } from '../ThemeContext'

function ThemeConsumer() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme('dark')}>set dark</button>
      <button onClick={() => setTheme('light')}>set light</button>
    </div>
  )
}

beforeEach(() => {
  document.documentElement.className = ''
})

describe('ThemeProvider', () => {
  it('defaults to light theme', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('adds theme-light class to documentElement on initial render', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    expect(document.documentElement.classList.contains('theme-light')).toBe(true)
  })

  it('setTheme("dark") updates theme and applies theme-dark class', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByText('set dark'))
    })
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
    expect(document.documentElement.classList.contains('theme-light')).toBe(false)
  })

  it('setTheme("light") removes theme-dark and adds theme-light', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByText('set dark'))
    })
    act(() => {
      fireEvent.click(screen.getByText('set light'))
    })
    expect(document.documentElement.classList.contains('theme-light')).toBe(true)
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false)
  })

  it('dark theme class persists after a re-render (simulating navigation)', () => {
    const { rerender } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    // Set to dark
    fireEvent.click(screen.getByRole('button', { name: /dark/i }))
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
    // Simulate a "navigation" by re-rendering with different children
    rerender(
      <ThemeProvider>
        <div data-testid="new-page">New Page</div>
      </ThemeProvider>,
    )
    // Theme class should still be present on documentElement
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
  })

  /**
   * HeroUI styles its dark variants off a plain `dark` class, while the
   * hand-written stylesheets use `theme-dark`. Both have to move together or
   * HeroUI components render light inside a dark app.
   */
  it('applies HeroUI\'s "dark" class alongside "theme-dark", and drops it again', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => {
      fireEvent.click(screen.getByText('set dark'))
    })
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => {
      fireEvent.click(screen.getByText('set light'))
    })
    expect(document.documentElement.classList.contains('theme-light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('useTheme throws when called outside ThemeProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function BareConsumer() {
      useTheme()
      return null
    }
    expect(() => render(<BareConsumer />)).toThrow('useTheme called outside ThemeProvider')
    consoleSpy.mockRestore()
  })
})

describe('TopBar theme toggle', () => {
  it('toggle theme button in TopBar switches between light and dark', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('light')
    act(() => {
      fireEvent.click(screen.getByText('set dark'))
    })
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    act(() => {
      fireEvent.click(screen.getByText('set light'))
    })
    expect(screen.getByTestId('theme').textContent).toBe('light')
  })
})
