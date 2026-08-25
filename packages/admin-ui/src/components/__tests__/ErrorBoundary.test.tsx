import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { ErrorBoundary } from '../ErrorBoundary'

function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new Error('kaboom')
  return <div data-testid="fine">fine</div>
}

beforeEach(() => {
  /** React logs the caught error itself; silence it so test output stays readable. */
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom explode={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('fine')).toBeInTheDocument()
  })

  it('shows the 500 page when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom explode />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('clears the error when resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Boom explode />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    rerender(
      <ErrorBoundary resetKey="/b">
        <Boom explode={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('fine')).toBeInTheDocument()
  })

  it('"Try again" re-renders the children', async () => {
    let explode = true
    function Toggle() {
      return <Boom explode={explode} />
    }

    render(
      <ErrorBoundary>
        <Toggle />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    explode = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByTestId('fine')).toBeInTheDocument()
  })
})
