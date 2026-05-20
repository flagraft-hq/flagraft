import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../../contexts/ThemeContext'
import { MainLayout } from '../MainLayout'

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ push: vi.fn(), dismiss: vi.fn(), toasts: [] }),
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    activeProject: { id: 'p1', name: 'Flagraft Demo', slug: 'flagraft-demo', flagCount: 0 },
    activeEnv: 'development',
    setActiveEnv: vi.fn(),
    projects: [],
    loading: false,
    error: null,
  }),
}))

function renderMainLayout(
  children: React.ReactNode = <div>Test Content</div>,
  initialPath = '/flags',
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ThemeProvider>
        <MainLayout>{children}</MainLayout>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('MainLayout', () => {
  it('renders children inside the main area', () => {
    renderMainLayout(<div>Hello World</div>)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders the TopBar with Flagraft brand text', () => {
    renderMainLayout()
    expect(screen.getByText('Flagraft')).toBeInTheDocument()
  })

  it('renders the SideNav with Flags nav item', () => {
    renderMainLayout()
    expect(screen.getByText('Flags')).toBeInTheDocument()
  })

  it('clicking a nav item in SideNav updates the active item (aria-current changes)', () => {
    renderMainLayout()

    // Initially flags should be active
    const flagsBtn = screen.getByText('Flags').closest('button')
    expect(flagsBtn).toHaveAttribute('aria-current', 'page')

    // Click Overrides
    fireEvent.click(screen.getByText('Overrides'))

    // Overrides should now be active
    const overridesBtn = screen.getByText('Overrides').closest('button')
    expect(overridesBtn).toHaveAttribute('aria-current', 'page')

    // Flags should no longer be active
    expect(flagsBtn).not.toHaveAttribute('aria-current')
  })

  it('renders the main content area with class "main"', () => {
    renderMainLayout(<span>Content Here</span>)
    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    expect(main).toHaveClass('main')
  })
})

describe('keyboard shortcuts', () => {
  it('pressing ? opens the shortcuts modal', () => {
    renderMainLayout()
    fireEvent.keyDown(document, { key: '?' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('pressing Escape closes the shortcuts modal', async () => {
    renderMainLayout()

    fireEvent.keyDown(document, { key: '?' })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
