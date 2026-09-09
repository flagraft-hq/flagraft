import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, FieldError, InputGroup, Label, TextField } from '@heroui/react'
import { useAuth } from '../../contexts/AuthContext'
import { inviteApi } from '../../lib/api'
import { Brand } from '../primitives/Brand'
import { FormError } from '../primitives/FormError'
import { Icon } from '../primitives/Icon'
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
          <Brand size="lg" />
          <div className="auth-pitch">
            <h1>
              You're almost in.
              <br />
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
          <Button size="sm" variant="ghost" onPress={() => navigate('/login')}>
            Sign in <Icon name="arrowRight" size={14} />
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
                  <Button variant="ghost" onPress={() => navigate('/login', { replace: true })}>
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
                  <TextField
                    className="field"
                    value={password}
                    onChange={(v) => {
                      setPassword(v)
                      if (error) setError(null)
                    }}
                    type={showPw ? 'text' : 'password'}
                    autoFocus
                  >
                    <Label>New password</Label>
                    <InputGroup fullWidth>
                      <InputGroup.Prefix>
                        <Icon name="key" size={14} />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                      />
                      <InputGroup.Suffix>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          onPress={() => setShowPw((v) => !v)}
                        >
                          <Icon name={showPw ? 'eyeOff' : 'eye'} size={14} />
                          <span className="sr-only">
                            {showPw ? 'Hide password' : 'Show password'}
                          </span>
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                    <PasswordStrength password={password} />
                  </TextField>

                  <TextField
                    className="field"
                    value={confirm}
                    onChange={setConfirm}
                    type={showPw ? 'text' : 'password'}
                    isInvalid={mismatch}
                  >
                    <Label>Confirm password</Label>
                    <InputGroup fullWidth>
                      <InputGroup.Prefix>
                        <Icon name="key" size={14} />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                      />
                    </InputGroup>
                    {/** Renders only while the field is invalid, i.e. while they differ. */}
                    <FieldError className="auth-warn">
                      <Icon name="alert" size={11} /> Passwords don&apos;t match
                    </FieldError>
                  </TextField>

                  <FormError message={error} />

                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    className="auth-submit"
                    isDisabled={!canSubmit}
                    isPending={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="auth-spinner" /> Activating&hellip;
                      </>
                    ) : (
                      <>
                        Activate account <Icon name="arrowRight" size={14} />
                      </>
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
