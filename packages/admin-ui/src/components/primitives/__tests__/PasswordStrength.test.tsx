import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PasswordStrength, strength } from '../PasswordStrength'

describe('strength', () => {
  it('rates passwords from too short to strong', () => {
    expect(strength('short')).toEqual({ score: 0, label: 'Too short' })
    expect(strength('aaaaaaaa')).toEqual({ score: 1, label: 'Weak' })
    expect(strength('aaaa1111')).toEqual({ score: 2, label: 'Good' })
    expect(strength('Aaaa1111aaaa')).toEqual({ score: 3, label: 'Strong' })
  })
})

describe('PasswordStrength', () => {
  it('renders nothing for an empty password', () => {
    const { container } = render(<PasswordStrength password="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the meter with the score and label', () => {
    const { container } = render(<PasswordStrength password="aaaa1111" />)
    expect(container.querySelector('.pw-meter')).toHaveAttribute('data-score', '2')
    expect(screen.getByText('Good')).toBeInTheDocument()
  })
})
