import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { inviteApi } from '../../lib/api'
import { Icon } from '../primitives/Icon'
import { Button } from '../primitives/Button'
import { PasswordStrength } from '../primitives/PasswordStrength'

type LinkState =
  | { status: 'loading' }
  | { status: 'valid'; email: string; name: string }
  | { status: 'invalid'; message: string }

/**
 * Public page reached from an invite link (/invite/:token). Validates the
 * token, then lets the invitee set a password to activate their account.
 * On success they are logged in and dropped into the app.
 */
export function AcceptInviteScreen() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { acceptInvite } = useAuth()

  const [link, setLink] = useState<LinkState>({ status: 'loading' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    inviteApi
      .get(token)
      .then((res) => {
        if (!cancelled) setLink({ status: 'valid', email: res.data.email, name: res.data.name })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setLink({
            status: 'invalid',
            message:
              err instanceof Error ? err.message : 'This invite link is invalid or has expired',
          })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit = password.length >= 8 && confirm === password && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      await acceptInvite(token, password)
      navigate('/flags', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not activate your account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-mark">
            <span
              className="brand-mark"
              style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', fontSize: '0.9375rem' }}
            >
              FR
            </span>
            <span style={{ fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              Flagraft
            </span>
          </div>
          <div className="auth-pitch">
            <h1>
              You're almost
              <br />
              in.
            </h1>
            <p>Set a password to activate your account and start shipping behind flags.</p>
          </div>
          <div className="auth-status">
            <span className="auth-status-dot" />
            Self-hosted feature flags
          </div>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-topbar">
          <span className="muted" style={{ fontSize: '0.7812rem' }}>
            Already have an account?
          </span>
          <Button
            size="sm"
            variant="ghost"
            rightIcon="arrowRight"
            onClick={() => navigate('/login')}
          >
            Sign in
          </Button>
        </div>

        <div className="auth-form-wrap">
          <div className="auth-form">
            {link.status === 'loading' ? (
              <div className="auth-form-head">
                <h2>Checking your invite…</h2>
                <p className="muted">One moment.</p>
              </div>
            ) : link.status === 'invalid' ? (
              <div className="auth-magic-sent">
                <div className="ill" data-tone="danger">
                  <Icon name="alert" size={22} />
                </div>
                <h3>Invite link expired</h3>
                <p className="muted">{link.message}</p>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Ask your workspace admin to send a fresh invite.
                </p>
                <div className="row" style={{ justifyContent: 'center', marginTop: '0.75rem' }}>
                  <Button variant="ghost" onClick={() => navigate('/login', { replace: true })}>
                    Go to sign in
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <header className="auth-form-head">
                  <h2>Set your password</h2>
                  <p className="muted">
                    Activating <span className="mono">{link.email}</span>
                  </p>
                </header>

                <form onSubmit={(e) => void handleSubmit(e)} noValidate>
                  <div className="field">
                    <label htmlFor="invite-pw">New password</label>
                    <div className="auth-input-wrap">
                      <Icon name="key" size={14} className="ic" />
                      <input
                        id="invite-pw"
                        className="input"
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (error) setError(null)
                        }}
                        placeholder="At least 8 characters"
                        autoFocus
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="auth-input-toggle"
                        onClick={() => setShowPw((v) => !v)}
                      >
                        <Icon name={showPw ? 'eyeOff' : 'eye'} size={14} />
                        <span className="sr-only">
                          {showPw ? 'Hide password' : 'Show password'}
                        </span>
                      </button>
                    </div>
                    <PasswordStrength password={password} />
                  </div>

                  <div className="field">
                    <label htmlFor="invite-pw2">Confirm password</label>
                    <div className="auth-input-wrap">
                      <Icon name="key" size={14} className="ic" />
                      <input
                        id="invite-pw2"
                        className="input"
                        type={showPw ? 'text' : 'password'}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                      />
                    </div>
                    {mismatch ? (
                      <span className="hint" style={{ color: 'var(--acc-fg)' }}>
                        <Icon name="alert" size={11} /> Passwords don't match
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
                    disabled={!canSubmit}
                  >
                    {submitting ? (
                      <>
                        <span className="auth-spinner" /> Activating&hellip;
                      </>
                    ) : (
                      'Activate account'
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
