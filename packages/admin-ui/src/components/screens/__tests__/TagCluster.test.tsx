import { render, screen } from '@testing-library/react'
import { TagCluster } from '../TagCluster'

describe('TagCluster', () => {
  it('renders a colored dot for each visible tag (default max 3)', () => {
    const { container } = render(<TagCluster tags={['alpha', 'beta', 'gamma']} />)
    expect(container.querySelectorAll('.tag-dot').length).toBe(3)
  })

  it('caps the number of dots at max but keeps all tags in the popover', () => {
    const { container } = render(<TagCluster tags={['a', 'b', 'c', 'd', 'e']} />)
    // Only 3 dots are shown...
    expect(container.querySelectorAll('.tag-dot').length).toBe(3)
    // ...but every tag is present as a chip in the hover popover.
    expect(container.querySelectorAll('.tag-chip').length).toBe(5)
  })

  it('respects a custom max for the number of dots', () => {
    const { container } = render(<TagCluster tags={['x', 'y', 'z', 'w']} max={2} />)
    expect(container.querySelectorAll('.tag-dot').length).toBe(2)
    expect(container.querySelectorAll('.tag-chip').length).toBe(4)
  })

  it('renders each tag label as a chip in the popover', () => {
    render(<TagCluster tags={['one', 'two', 'three']} />)
    expect(screen.getByText('one')).toBeTruthy()
    expect(screen.getByText('two')).toBeTruthy()
    expect(screen.getByText('three')).toBeTruthy()
  })

  it('maps tag names to color-dot classes (non-letters stripped)', () => {
    const { container } = render(<TagCluster tags={['kill-switch']} />)
    expect(container.querySelector('.tag-killswitch')).toBeTruthy()
  })

  it('renders an empty cluster without crashing when tags is empty', () => {
    const { container } = render(<TagCluster tags={[]} />)
    expect(container.querySelector('.tag-cluster')).toBeTruthy()
    expect(container.querySelectorAll('.tag-dot').length).toBe(0)
    expect(container.querySelectorAll('.tag-chip').length).toBe(0)
  })
})
