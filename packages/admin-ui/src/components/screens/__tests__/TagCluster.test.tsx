import { render, screen } from '@testing-library/react'
import { TagCluster } from '../TagCluster'

describe('TagCluster', () => {
  it('renders all tags when count <= max (default 3)', () => {
    render(<TagCluster tags={['alpha', 'beta', 'gamma']} />)
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
    expect(screen.getByText('gamma')).toBeTruthy()
  })

  it('renders all tags when count is less than max', () => {
    render(<TagCluster tags={['alpha', 'beta']} />)
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
  })

  it('shows first 3 tags and "+N more" when count > 3', () => {
    render(<TagCluster tags={['a', 'b', 'c', 'd', 'e']} />)
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('b')).toBeTruthy()
    expect(screen.getByText('c')).toBeTruthy()
    expect(screen.queryByText('d')).toBeNull()
    expect(screen.queryByText('e')).toBeNull()
    expect(screen.getByText('+2 more')).toBeTruthy()
  })

  it('shows the overflow indicator with correct class', () => {
    const { container } = render(<TagCluster tags={['a', 'b', 'c', 'd']} />)
    expect(container.querySelector('.tag-overflow')).toBeTruthy()
    expect(screen.getByText('+1 more')).toBeTruthy()
  })

  it('respects a custom max prop', () => {
    render(<TagCluster tags={['x', 'y', 'z', 'w']} max={2} />)
    expect(screen.getByText('x')).toBeTruthy()
    expect(screen.getByText('y')).toBeTruthy()
    expect(screen.queryByText('z')).toBeNull()
    expect(screen.queryByText('w')).toBeNull()
    expect(screen.getByText('+2 more')).toBeTruthy()
  })

  it('renders tag-item elements for visible tags', () => {
    const { container } = render(<TagCluster tags={['one', 'two', 'three']} />)
    const items = container.querySelectorAll('.tag-item')
    expect(items.length).toBe(3)
  })

  it('renders empty without crashing when tags is empty', () => {
    const { container } = render(<TagCluster tags={[]} />)
    const cluster = container.querySelector('.tag-cluster')
    expect(cluster).toBeTruthy()
    expect(container.querySelectorAll('.tag-item').length).toBe(0)
    expect(container.querySelector('.tag-overflow')).toBeNull()
  })

  it('does not show overflow when count equals max exactly', () => {
    const { container } = render(<TagCluster tags={['a', 'b', 'c']} max={3} />)
    expect(container.querySelector('.tag-overflow')).toBeNull()
  })
})
