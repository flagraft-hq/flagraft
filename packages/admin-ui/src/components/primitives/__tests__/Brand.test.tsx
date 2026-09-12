import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Brand } from '../Brand'

describe('Brand', () => {
  it('shows the wordmark once, with the mark marked decorative', () => {
    const { container } = render(<Brand />)
    expect(screen.getByText('Flagraft')).toBeInTheDocument()
    /** An alt of "" keeps a screen reader from reading the name twice. */
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('defaults to the small size and honours the large one', () => {
    const { container, unmount } = render(<Brand />)
    expect(container.querySelector('.brand')).toHaveAttribute('data-size', 'sm')
    unmount()
    const lg = render(<Brand size="lg" />)
    expect(lg.container.querySelector('.brand')).toHaveAttribute('data-size', 'lg')
  })
})
