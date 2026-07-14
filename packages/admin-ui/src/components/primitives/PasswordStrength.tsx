/**
 * Rough password strength for the meter only. The 8-char minimum is the real
 * gate (enforced client- and server-side); the tiers are just user feedback.
 */
export function strength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length < 8) return { score: 0, label: 'Too short' }
  let variety = 0
  if (/[a-z]/.test(pw)) variety++
  if (/[A-Z]/.test(pw)) variety++
  if (/\d/.test(pw)) variety++
  if (/[^a-zA-Z0-9]/.test(pw)) variety++
  if (pw.length >= 12 && variety >= 3) return { score: 3, label: 'Strong' }
  if (variety >= 2) return { score: 2, label: 'Good' }
  return { score: 1, label: 'Weak' }
}

/**
 * Three-segment strength meter shown under a new-password input.
 * Renders nothing until the user starts typing.
 */
export function PasswordStrength({ password }: { password: string }) {
  if (password.length === 0) return null
  const { score, label } = strength(password)
  return (
    <div className="pw-meter" data-score={score}>
      <span />
      <span />
      <span />
      <em>{label}</em>
    </div>
  )
}
