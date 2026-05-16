import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from '../FilterBar'

const defaultProps = {
  search: '',
  onSearchChange: vi.fn(),
  selectedTags: [],
  onTagsChange: vi.fn(),
  availableTags: [],
  stateFilter: 'all' as const,
  onStateFilterChange: vi.fn(),
}

describe('FilterBar', () => {
  it('renders search input with correct value', () => {
    render(<FilterBar {...defaultProps} search="hello" />)
    const input = screen.getByPlaceholderText('Search flags...')
    expect(input).toHaveValue('hello')
  })

  it('calls onSearchChange when input changes', async () => {
    const onSearchChange = vi.fn()
    render(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />)
    const input = screen.getByPlaceholderText('Search flags...')
    await userEvent.type(input, 'abc')
    expect(onSearchChange).toHaveBeenCalled()
  })

  it('renders All, On, and Off state buttons', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'On' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Off' })).toBeInTheDocument()
  })

  it('active state button has filter-state-btn-active class', () => {
    render(<FilterBar {...defaultProps} stateFilter="on" />)
    const onBtn = screen.getByRole('button', { name: 'On' })
    expect(onBtn).toHaveClass('filter-state-btn-active')
    const allBtn = screen.getByRole('button', { name: 'All' })
    expect(allBtn).not.toHaveClass('filter-state-btn-active')
  })

  it('clicking a state button calls onStateFilterChange', async () => {
    const onStateFilterChange = vi.fn()
    render(<FilterBar {...defaultProps} onStateFilterChange={onStateFilterChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Off' }))
    expect(onStateFilterChange).toHaveBeenCalledWith('off')
  })

  it('renders available tags as chips', () => {
    render(<FilterBar {...defaultProps} availableTags={['backend', 'frontend']} />)
    expect(screen.getByRole('button', { name: 'backend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'frontend' })).toBeInTheDocument()
  })

  it('clicking a tag chip calls onTagsChange with the tag added', async () => {
    const onTagsChange = vi.fn()
    render(
      <FilterBar
        {...defaultProps}
        availableTags={['backend', 'frontend']}
        onTagsChange={onTagsChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'backend' }))
    expect(onTagsChange).toHaveBeenCalledWith(['backend'])
  })

  it('clicking an active tag chip calls onTagsChange with the tag removed', async () => {
    const onTagsChange = vi.fn()
    render(
      <FilterBar
        {...defaultProps}
        availableTags={['backend', 'frontend']}
        selectedTags={['backend']}
        onTagsChange={onTagsChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'backend' }))
    expect(onTagsChange).toHaveBeenCalledWith([])
  })

  it('does not render tag area when availableTags is empty', () => {
    render(<FilterBar {...defaultProps} availableTags={[]} />)
    expect(document.querySelector('.filter-tags')).not.toBeInTheDocument()
  })
})
