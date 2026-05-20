import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

function fireKey(
  key: string,
  opts: { metaKey?: boolean; ctrlKey?: boolean; target?: Element } = {},
) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    bubbles: true,
    cancelable: true,
  })

  if (opts.target) {
    Object.defineProperty(event, 'target', { value: opts.target, configurable: true })
  }

  Object.defineProperty(document, 'activeElement', {
    value: opts.target ?? document.body,
    configurable: true,
  })

  document.dispatchEvent(event)
  return event
}

afterEach(() => {
  Object.defineProperty(document, 'activeElement', {
    value: document.body,
    configurable: true,
  })
  vi.restoreAllMocks()
})

describe('useKeyboardShortcuts', () => {
  it('dispatches handler when matching key is pressed', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    fireKey('/')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does NOT dispatch when focus is in an input', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    const input = document.createElement('input')
    fireKey('/', { target: input })
    expect(handler).not.toHaveBeenCalled()
  })

  it('DOES dispatch Escape even when focus is in an input', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ Escape: handler }))
    const input = document.createElement('input')
    fireKey('Escape', { target: input })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does NOT dispatch when focus is in a textarea', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    const textarea = document.createElement('textarea')
    fireKey('/', { target: textarea })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does NOT dispatch for unregistered keys', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    fireKey('k')
    expect(handler).not.toHaveBeenCalled()
  })

  it('dispatches cmd+k when metaKey is held', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ 'cmd+k': handler }))
    fireKey('k', { metaKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('dispatches cmd+k when ctrlKey is held (non-Mac)', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ 'cmd+k': handler }))
    fireKey('k', { ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('calls preventDefault when handler fires', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    const event = fireKey('/')
    expect(event.defaultPrevented).toBe(true)
  })

  it('cleans up listener on unmount', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcuts({ '/': handler }))
    unmount()
    fireKey('/')
    expect(handler).not.toHaveBeenCalled()
  })

  it('does NOT dispatch Escape when focus is in a contenteditable element (Escape is only exempt from input/textarea)', () => {
    const nonEscapeHandler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': nonEscapeHandler }))
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    fireKey('/', { target: div })
    expect(nonEscapeHandler).not.toHaveBeenCalled()
  })

  it('DOES dispatch Escape when focus is in a contenteditable element', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ Escape: handler }))
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    fireKey('Escape', { target: div })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
