import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Icon } from '../primitives/Icon'
import { Button } from '../primitives/Button'

/** Illustrative rows for the brand panel's product preview card. */
const PREVIEW_FLAGS = [
  { key: 'checkout-v2', desc: 'New checkout flow', on: true },
  { key: 'new-dashboard', desc: 'Enabled in production', on: true },
  { key: 'ai-suggestions', desc: 'Off in production', on: false },
]

/**
 * Full-page login screen: brand panel with a product preview on the left,
 * email + password form on the right. Password auth is the only method the
 * backend supports, so it is the only method offered here.
 */
export function LoginScreen() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capsOn, setCapsOn] = useState(false)
  const [showForgotHint, setShowForgotHint] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/flags', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Brand panel - hidden below 880px */}
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-mark">
            <span
              className="brand-mark"
              style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.6875rem', fontSize: '0.875rem' }}
            >
              FR
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              Flagraft
            </span>
          </div>

          <div className="auth-pitch">
            <h1>Ship features without redeploying.</h1>
            <p>Toggle flags per environment in real time, this is what's waiting inside.</p>
          </div>

          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-head">
              <span className="auth-preview-title">
                <span className="auth-preview-logo">
                  <Icon name="flag" size={13} />
                </span>
                Feature flags
              </span>
              <span className="auth-preview-env mono">Production</span>
            </div>
            {PREVIEW_FLAGS.map((f) => (
              <div key={f.key} className="auth-preview-row">
                <div>
                  <div className="key">{f.key}</div>
                  <div className="desc">{f.desc}</div>
                </div>
                <span className="auth-preview-toggle" data-off={f.on ? undefined : ''} />
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Form column */}
      <main className="auth-main">
        <div className="auth-form-wrap">
          <div className="auth-form">
            <header className="auth-form-head">
              <h2>Sign in to Flagraft</h2>
              <p className="muted">Enter your email and password to continue.</p>
            </header>

            <form onSubmit={(e) => void handleSubmit(e)} noValidate>
              <div className="field">
                <label htmlFor="auth-email">Email</label>
                <div className="auth-input-wrap">
                  <Icon name="user" size={14} className="ic" />
                  <input
                    id="auth-email"
                    className="input mono"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="field">
                <div className="auth-label-row">
                  <label htmlFor="auth-pw">Password</label>
                  <button
                    type="button"
                    className="auth-forgot"
                    aria-expanded={showForgotHint}
                    onClick={() => setShowForgotHint((v) => !v)}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="auth-input-wrap">
                  <Icon name="key" size={14} className="ic" />
                  <input
                    id="auth-pw"
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError(null)
                    }}
                    onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowPw((v) => !v)}
                  >
                    <Icon name={showPw ? 'eyeOff' : 'eye'} size={14} />
                    <span className="sr-only">{showPw ? 'Hide password' : 'Show password'}</span>
                  </button>
                </div>
                {showForgotHint ? (
                  <span className="hint">
                    <Icon name="info" size={11} /> There's no self-service reset — a workspace admin
                    can reset it for you.
                  </span>
                ) : null}
                {capsOn ? (
                  <span className="hint" style={{ color: 'var(--acc-fg)' }}>
                    <Icon name="alert" size={11} /> Caps Lock is on
                  </span>
                ) : null}
              </div>

              {error ? (
                <div role="alert" className="err">
                  <Icon name="alert" size={13} />
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                className="auth-submit"
                rightIcon={submitting ? undefined : 'arrowRight'}
                disabled={submitting}
                aria-label={submitting ? 'Signing in' : undefined}
              >
                {submitting ? (
                  <>
                    <span className="auth-spinner" /> Signing in&hellip;
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>

              <p className="auth-form-note muted">Access is invite-only, ask a workspace admin.</p>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
