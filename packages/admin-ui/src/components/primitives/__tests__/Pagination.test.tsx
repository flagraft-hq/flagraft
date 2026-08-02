import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Pagination } from '../Pagination'

const props = { total: 0, limit: 25, offset: 0, onOffsetChange: vi.fn(), noun: 'flag' }

describe('Pagination', () => {
  it('keeps the controls visible on a single page, with both arrows disabled', () => {
    render(<Pagination {...props} total={7} />)
    expect(screen.getByText('1–7 of 7 flags')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows a single empty page when nothing matches', () => {
    render(<Pagination {...props} total={0} />)
    expect(screen.getByText('0 flags')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('pluralises the noun', () => {
    render(<Pagination {...props} total={1} />)
    expect(screen.getByText('1–1 of 1 flag')).toBeInTheDocument()
  })

  it('hides the page-size selector unless onLimitChange is given', () => {
    const { rerender } = render(<Pagination {...props} total={7} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    rerender(<Pagination {...props} total={7} onLimitChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'flags per page' })).toHaveValue('25')
  })

  it('reports the chosen page size as a number', async () => {
    const onLimitChange = vi.fn()
    render(<Pagination {...props} total={200} onLimitChange={onLimitChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'flags per page' }), '100')
    expect(onLimitChange).toHaveBeenCalledWith(100)
  })

  it('reports the range covered by the current page', () => {
    render(<Pagination {...props} total={340} offset={50} />)
    expect(screen.getByText('51–75 of 340 flags')).toBeInTheDocument()
  })

  it('caps the final page range at the total', () => {
    render(<Pagination {...props} total={52} offset={50} />)
    expect(screen.getByText('51–52 of 52 flags')).toBeInTheDocument()
  })

  it('marks the current page and jumps when another page is clicked', async () => {
    const onOffsetChange = vi.fn()
    render(<Pagination {...props} total={100} offset={25} onOffsetChange={onOffsetChange} />)

    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Page 4' }))
    expect(onOffsetChange).toHaveBeenCalledWith(75)
  })

  it('steps one page at a time with prev and next', async () => {
    const onOffsetChange = vi.fn()
    render(<Pagination {...props} total={100} offset={25} onOffsetChange={onOffsetChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onOffsetChange).toHaveBeenLastCalledWith(50)
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onOffsetChange).toHaveBeenLastCalledWith(0)
  })

  it('disables prev on the first page and next on the last', () => {
    const { rerender } = render(<Pagination {...props} total={100} offset={0} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()

    rerender(<Pagination {...props} total={100} offset={75} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('collapses long page runs but always keeps first, last and current', () => {
    render(<Pagination {...props} total={1000} offset={500} />)
    const pages = screen
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => t && /^\d+$/.test(t))

    expect(pages).toEqual(['1', '20', '21', '22', '40'])
    expect(screen.getAllByText('…')).toHaveLength(2)
  })
})
