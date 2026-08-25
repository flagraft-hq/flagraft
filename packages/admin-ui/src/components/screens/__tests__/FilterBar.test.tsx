import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from '../FilterBar'
import type { StateFilter } from '../../../lib/types'

const defaultProps = {
  search: '',
  onSearchChange: vi.fn(),
  stateFilter: null as StateFilter,
  onStateFilterChange: vi.fn(),
  envName: 'Production',
  onClearAll: vi.fn(),
}

const PLACEHOLDER = 'Filter by name or key...'

describe('FilterBar', () => {
  it('renders search input with correct value', () => {
    render(<FilterBar {...defaultProps} search="hello" />)
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('hello')
  })

  it('calls onSearchChange when input changes', async () => {
    const onSearchChange = vi.fn()
    render(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />)
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), 'a')
    expect(onSearchChange).toHaveBeenCalledWith('a')
  })

  it('names the environment the state filter applies to', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByRole('group', { name: 'State filter for Production' })).toBeInTheDocument()
  })

  it('marks the active state chip as pressed', () => {
    render(<FilterBar {...defaultProps} stateFilter="on" />)
    expect(screen.getByRole('button', { name: 'Enabled' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Disabled' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects a state filter when its chip is clicked', async () => {
    const onStateFilterChange = vi.fn()
    render(<FilterBar {...defaultProps} onStateFilterChange={onStateFilterChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Disabled' }))
    expect(onStateFilterChange).toHaveBeenCalledWith('off')
  })

  it('clears the state filter when "All" is clicked', async () => {
    const onStateFilterChange = vi.fn()
    render(
      <FilterBar {...defaultProps} stateFilter="on" onStateFilterChange={onStateFilterChange} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onStateFilterChange).toHaveBeenCalledWith(null)
  })

  it('hides "Clear all" until a filter is active', () => {
    const { rerender } = render(<FilterBar {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument()

    rerender(<FilterBar {...defaultProps} search="x" />)
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument()

    rerender(<FilterBar {...defaultProps} stateFilter="on" />)
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument()
  })

  it('ignores a whitespace-only search when deciding to show "Clear all"', () => {
    render(<FilterBar {...defaultProps} search="   " />)
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument()
  })

  it('calls onClearAll when "Clear all" is clicked', async () => {
    const onClearAll = vi.fn()
    render(<FilterBar {...defaultProps} search="x" onClearAll={onClearAll} />)
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(onClearAll).toHaveBeenCalled()
  })
})
