import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ToastProvider } from '../ToastContext'
import { useToast } from '../../hooks/useToast'

function TestConsumer() {
  const { toasts, push, dismiss } = useToast()
  return (
    <div>
      <span data-testid="count">{toasts.length}</span>
      {toasts.map((t) => (
        <div key={t.id} data-testid={`toast-${t.id}`}>
          <span data-testid={`title-${t.id}`}>{t.title}</span>
          {t.msg && <span data-testid={`msg-${t.id}`}>{t.msg}</span>}
          <span data-testid={`variant-${t.id}`}>{t.variant ?? 'default'}</span>
          <button onClick={() => dismiss(t.id)}>dismiss-{t.id}</button>
        </div>
      ))}
      <button
        data-testid="push-btn"
        onClick={() => push({ title: 'Hello', msg: 'World', variant: 'success' })}
      >
        push
      </button>
      <button
        data-testid="push-two"
        onClick={() => {
          push({ title: 'First' })
          push({ title: 'Second' })
        }}
      >
        push two
      </button>
    </div>
  )
}

describe('ToastContext', () => {
  it('initially has no toasts', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('push adds a toast with title and msg', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    act(() => {
      screen.getByTestId('push-btn').click()
    })
    expect(screen.getByTestId('count').textContent).toBe('1')
    const toastId = screen
      .getAllByTestId(/^title-/)[0]
      .getAttribute('data-testid')!
      .replace('title-', '')
    expect(screen.getByTestId(`title-${toastId}`).textContent).toBe('Hello')
    expect(screen.getByTestId(`msg-${toastId}`).textContent).toBe('World')
    expect(screen.getByTestId(`variant-${toastId}`).textContent).toBe('success')
  })

  it('push generates a unique id per toast', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    act(() => {
      screen.getByTestId('push-two').click()
    })
    expect(screen.getByTestId('count').textContent).toBe('2')
    const titleEls = screen.getAllByTestId(/^title-/)
    const ids = titleEls.map((el) => el.getAttribute('data-testid')!.replace('title-', ''))
    expect(ids[0]).not.toBe(ids[1])
  })

  it('dismiss removes a toast by id', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    act(() => {
      screen.getByTestId('push-btn').click()
    })
    expect(screen.getByTestId('count').textContent).toBe('1')
    const dismissBtn = screen.getAllByText(/^dismiss-/)[0]
    act(() => {
      dismissBtn.click()
    })
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('renders pushed toasts in the toast stack with the variant class', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    act(() => {
      screen.getByTestId('push-btn').click()
    })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Hello')
    expect(status).toHaveClass('toast', 'success')
    /** The progress bar animation must run exactly as long as the dismiss timer. */
    expect(status.style.getPropertyValue('--toast-duration')).toBe('4000ms')
  })

  it('removes a rendered toast when its Dismiss button is clicked', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    act(() => {
      screen.getByTestId('push-btn').click()
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => {
      screen.getByRole('button', { name: 'Dismiss' }).click()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('auto-dismisses a short toast after the 4s floor', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    )
    act(() => {
      screen.getByTestId('push-two').click()
    })
    expect(screen.getByTestId('count').textContent).toBe('2')
    act(() => {
      vi.advanceTimersByTime(4100)
    })
    expect(screen.getByTestId('count').textContent).toBe('0')
    vi.useRealTimers()
  })

  it('keeps a long error toast on screen longer than the floor', () => {
    vi.useFakeTimers()
    function LongErrorConsumer() {
      const { toasts, push } = useToast()
      return (
        <div>
          <span data-testid="count">{toasts.length}</span>
          <button
            data-testid="push-long"
            onClick={() =>
              push({
                title: 'Failed to resend invites',
                msg: 'This invite was sent moments ago. Wait a couple of minutes before resending.',
                variant: 'error',
              })
            }
          >
            push long
          </button>
        </div>
      )
    }
    render(
      <ToastProvider>
        <LongErrorConsumer />
      </ToastProvider>,
    )
    act(() => {
      screen.getByTestId('push-long').click()
    })
    /** ~100 chars * 60ms ≈ 6s: still visible after the 4s floor... */
    act(() => {
      vi.advanceTimersByTime(4100)
    })
    expect(screen.getByTestId('count').textContent).toBe('1')
    /** ...but gone by the 12s ceiling. */
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(screen.getByTestId('count').textContent).toBe('0')
    vi.useRealTimers()
  })

  it('keeps a sticky toast until it is dismissed', () => {
    vi.useFakeTimers()
    function StickyConsumer() {
      const { toasts, push } = useToast()
      return (
        <div>
          <span data-testid="count">{toasts.length}</span>
          <button
            data-testid="push-sticky"
            onClick={() => push({ title: 'Invite resent', msg: 'Copied', sticky: true })}
          >
            push sticky
          </button>
        </div>
      )
    }
    render(
      <ToastProvider>
        <StickyConsumer />
      </ToastProvider>,
    )
    act(() => {
      screen.getByTestId('push-sticky').click()
    })
    /** Well past the 12s ceiling: a sticky toast has no timer at all. */
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByTestId('count').textContent).toBe('1')
    expect(screen.getByRole('status')).toHaveClass('is-sticky')
    act(() => {
      screen.getByRole('button', { name: 'Dismiss' }).click()
    })
    expect(screen.getByTestId('count').textContent).toBe('0')
    vi.useRealTimers()
  })

  it('useToast throws when called outside ToastProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useToast called outside ToastProvider')
    consoleSpy.mockRestore()
  })
})
