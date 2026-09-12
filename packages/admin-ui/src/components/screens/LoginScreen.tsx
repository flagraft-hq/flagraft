import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Description, InputGroup, Label, TextField } from '@heroui/react'
import { useAuth } from '../../contexts/AuthContext'
import { safeNext } from '../../lib/nextPath'
import { Brand } from '../primitives/Brand'
import { FormError } from '../primitives/FormError'
import { Icon } from '../primitives/Icon'

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
  const { search } = useLocation()
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
      navigate(safeNext(search), { replace: true })
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
          <Brand size="lg" />

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
              <TextField className="field" value={email} onChange={setEmail} type="email" autoFocus>
                <Label>Email</Label>
                <InputGroup fullWidth>
                  <InputGroup.Prefix>
                    <Icon name="user" size={14} />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    className="mono"
                    placeholder="you@company.com"
                    autoComplete="username"
                  />
                </InputGroup>
              </TextField>

              <TextField
                className="field"
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  if (error) setError(null)
                }}
                type={showPw ? 'text' : 'password'}
              >
                <div className="auth-label-row">
                  <Label>Password</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="auth-forgot"
                    aria-expanded={showForgotHint}
                    onPress={() => setShowForgotHint((v) => !v)}
                  >
                    Forgot password?
                  </Button>
                </div>
                <InputGroup fullWidth>
                  <InputGroup.Prefix>
                    <Icon name="key" size={14} />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    placeholder="••••••••"
                    autoComplete="current-password"
                    onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
                  />
                  <InputGroup.Suffix>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      onPress={() => setShowPw((v) => !v)}
                    >
                      <Icon name={showPw ? 'eyeOff' : 'eye'} size={14} />
                      <span className="sr-only">{showPw ? 'Hide password' : 'Show password'}</span>
                    </Button>
                  </InputGroup.Suffix>
                </InputGroup>
                {showForgotHint ? (
                  <div className="auth-info-msg">
                    <Icon name="info" size={14} />
                    <span>
                      There's no self-service reset, a workspace admin can reset it for you.
                    </span>
                  </div>
                ) : null}
                {capsOn ? (
                  <Description className="auth-warn">
                    <Icon name="alert" size={11} /> Caps Lock is on
                  </Description>
                ) : null}
              </TextField>

              <FormError message={error} />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                className="auth-submit"
                isDisabled={submitting}
                isPending={submitting}
              >
                {submitting ? (
                  <>
                    <span className="auth-spinner" /> Signing in&hellip;
                  </>
                ) : (
                  <>
                    Sign in <Icon name="arrowRight" size={14} />
                  </>
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
