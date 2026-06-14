import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from '../FilterBar'
import type { StateFilter } from '../../../lib/types'


const defaultProps = {
  search: '',
  onSearchChange: vi.fn(),
  topTags: [] as [string, number][],
  selectedTags: [] as string[],
  onTagsChange: vi.fn(),
  stateFilter: null as StateFilter,
  onStateFilterChange: vi.fn(),
  resultCount: 0,
  totalCount: 0,
  onClearAll: vi.fn(),
}

const PLACEHOLDER = 'Search by name, key, description…'

describe('FilterBar', () => {
  it('renders search input with correct value', () => {
    render(<FilterBar {...defaultProps} search="hello" />)
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('hello')
  })

  it('calls onSearchChange when input changes', async () => {
    const onSearchChange = vi.fn()
    render(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />)
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), 'abc')
    expect(onSearchChange).toHaveBeenCalled()
  })

  it('renders the four state-filter chips', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /on anywhere/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /off everywhere/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /has overrides/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kill switches/i })).toBeInTheDocument()
  })

  it('marks the active state chip with aria-pressed', () => {
    render(<FilterBar {...defaultProps} stateFilter="on" />)
    expect(
      screen.getByRole('button', { name: /on anywhere/i }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen.getByRole('button', { name: /off everywhere/i }).getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('clicking an inactive state chip selects it', async () => {
    const onStateFilterChange = vi.fn()
    render(<FilterBar {...defaultProps} onStateFilterChange={onStateFilterChange} />)
    await userEvent.click(screen.getByRole('button', { name: /off everywhere/i }))
    expect(onStateFilterChange).toHaveBeenCalledWith('off')
  })

  it('clicking the active state chip clears it', async () => {
    const onStateFilterChange = vi.fn()
    render(
      <FilterBar {...defaultProps} stateFilter="on" onStateFilterChange={onStateFilterChange} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /on anywhere/i }))
    expect(onStateFilterChange).toHaveBeenCalledWith(null)
  })

  it('renders top tags as chips with their counts', () => {
    render(
      <FilterBar
        {...defaultProps}
        topTags={[
          ['backend', 3],
          ['frontend', 1],
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: /backend/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /frontend/i })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('clicking a tag chip calls onTagsChange with the tag added', async () => {
    const onTagsChange = vi.fn()
    render(
      <FilterBar
        {...defaultProps}
        topTags={[
          ['backend', 3],
          ['frontend', 1],
        ]}
        onTagsChange={onTagsChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /backend/i }))
    expect(onTagsChange).toHaveBeenCalledWith(['backend'])
  })

  it('clicking an active tag chip calls onTagsChange with the tag removed', async () => {
    const onTagsChange = vi.fn()
    render(
      <FilterBar
        {...defaultProps}
        topTags={[['backend', 3]]}
        selectedTags={['backend']}
        onTagsChange={onTagsChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /backend/i }))
    expect(onTagsChange).toHaveBeenCalledWith([])
  })

  it('does not render the tag chip group when there are no top tags', () => {
    render(<FilterBar {...defaultProps} topTags={[]} />)
    expect(document.querySelector('.filter-tags')).not.toBeInTheDocument()
  })

  it('shows the result count (pluralized) when no filters are active', () => {
    render(<FilterBar {...defaultProps} resultCount={3} totalCount={3} />)
    expect(screen.getByText('3 flags')).toBeInTheDocument()
  })

  it('shows a "X of Y" count and a Clear all button when filters are active', async () => {
    const onClearAll = vi.fn()
    render(
      <FilterBar
        {...defaultProps}
        stateFilter="on"
        resultCount={1}
        totalCount={3}
        onClearAll={onClearAll}
      />,
    )
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    const clearBtn = screen.getByRole('button', { name: /clear all/i })
    await userEvent.click(clearBtn)
    expect(onClearAll).toHaveBeenCalled()
  })
})
