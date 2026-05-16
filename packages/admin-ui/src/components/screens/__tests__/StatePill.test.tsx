import { render, screen } from '@testing-library/react'
import { StatePill } from '../StatePill'

describe('StatePill', () => {
  it('renders "On" text when on={true}', () => {
    render(<StatePill on={true} />)
    expect(screen.getByText('On')).toBeTruthy()
  })

  it('has class state-pill-on when on={true}', () => {
    const { container } = render(<StatePill on={true} />)
    expect(container.querySelector('.state-pill-on')).toBeTruthy()
  })

  it('renders "Off" text when on={false}', () => {
    render(<StatePill on={false} />)
    expect(screen.getByText('Off')).toBeTruthy()
  })

  it('has class state-pill-off when on={false}', () => {
    const { container } = render(<StatePill on={false} />)
    expect(container.querySelector('.state-pill-off')).toBeTruthy()
  })

  it('shows envName when provided', () => {
    render(<StatePill on={true} envName="production" />)
    expect(screen.getByText('production')).toBeTruthy()
    const { container } = render(<StatePill on={true} envName="staging" />)
    expect(container.querySelector('.state-pill-env')).toBeTruthy()
  })

  it('does not show envName element when not provided', () => {
    const { container } = render(<StatePill on={true} />)
    expect(container.querySelector('.state-pill-env')).toBeNull()
  })

  it('shows overrides count when overrides > 0', () => {
    render(<StatePill on={true} overrides={3} />)
    expect(screen.getByText('3')).toBeTruthy()
    const { container } = render(<StatePill on={true} overrides={5} />)
    expect(container.querySelector('.state-pill-overrides')).toBeTruthy()
  })

  it('does not show overrides element when overrides is 0', () => {
    const { container } = render(<StatePill on={true} overrides={0} />)
    expect(container.querySelector('.state-pill-overrides')).toBeNull()
  })

  it('does not show overrides element when overrides is undefined', () => {
    const { container } = render(<StatePill on={false} />)
    expect(container.querySelector('.state-pill-overrides')).toBeNull()
  })
})
