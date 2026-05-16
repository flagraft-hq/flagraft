import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tip } from '../Tip'

describe('Tip', () => {
  it('renders children', () => {
    render(
      <Tip tip="Help text">
        <button>Hover me</button>
      </Tip>,
    )
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('shows tooltip on hover', async () => {
    render(
      <Tip tip="Help text">
        <button>Hover me</button>
      </Tip>,
    )
    const button = screen.getByRole('button')
    await userEvent.hover(button)
    expect(screen.getByText('Help text')).toBeVisible()
  })

  it('hides tooltip on unhover', async () => {
    render(
      <Tip tip="Help text">
        <button>Hover me</button>
      </Tip>,
    )
    const button = screen.getByRole('button')
    await userEvent.hover(button)
    await userEvent.unhover(button)
    const tooltip = screen.queryByText('Help text')
    expect(tooltip).not.toBeInTheDocument()
  })

  it('has accessible tooltip attributes', async () => {
    render(
      <Tip tip="Help text">
        <button>Hover me</button>
      </Tip>,
    )
    const button = screen.getByRole('button')
    await userEvent.hover(button)
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveAttribute('aria-label', 'Help text')
  })
})
