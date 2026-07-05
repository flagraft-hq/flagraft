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

  it('useToast throws when called outside ToastProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useToast called outside ToastProvider')
    consoleSpy.mockRestore()
  })
})
