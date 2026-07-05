import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../hooks/useToast'
import { workspaceApi } from '../../lib/api'
import { Icon } from '../primitives/Icon'
import { Button } from '../primitives/Button'
import { Tip } from '../primitives/Tip'

/** Inline Google G SVG logo for the Google SSO button. */
function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}

interface WorkspaceInfo {
  projectName: string | null
  flagCount: number
}

/** Full-page login screen with brand panel on the left and auth form on the right. */
export function LoginScreen() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const toast = useToast()

  const [mode, setMode] = useState<'password' | 'magic' | 'sso'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo | null>(null)

  const pwRef = useRef<HTMLInputElement>(null)

  /** Fetch workspace info silently on mount to populate the brand panel stats. */
  useEffect(() => {
    workspaceApi
      .info()
      .then((res) => {
        setWorkspaceInfo({ projectName: res.data.projectName, flagCount: res.data.flagCount })
      })
      .catch(() => {
        // Silently ignore errors - the brand panel will show placeholder values.
      })
  }, [])

  /**
   * Detects whether the typed email belongs to a known SSO domain.
   * Currently recognises kocharsoft.com as a SAML / Okta workspace.
   */
  const ssoDomain = useMemo(() => {
    const m = /@([^@\s]+)$/.exec(email)
    const d = m?.[1]
    if (!d) return null
    if (d.endsWith('kocharsoft.com')) return { name: 'Kocharsoft', method: 'SAML · Okta' }
    return null
  }, [email])

  /** Fires the "coming soon" toast for unimplemented auth methods. */
  function notifyComingSoon() {
    toast.push({ title: 'Coming soon', variant: 'error' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode !== 'password') {
      notifyComingSoon()
      return
    }
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

  const headingText =
    mode === 'magic'
      ? 'Email me a sign-in link'
      : mode === 'sso'
        ? 'Continue with SSO'
        : 'Sign in to Flagraft'

  const subtitleText =
    mode === 'magic' ? (
      "We'll send a one-time link that expires in 10 minutes."
    ) : mode === 'sso' ? (
      ssoDomain ? (
        <>
          Your workspace uses <b style={{ color: 'var(--text-1)' }}>{ssoDomain.method}</b> through{' '}
          {ssoDomain.name}.
        </>
      ) : (
        'Enter your work email to be redirected.'
      )
    ) : (
      'Use your work email — your admin sets up SSO and provisioning.'
    )

  return (
    <div className="auth-page">
      {/* Brand panel - hidden below 880px */}
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-brand-mark">
            <span
              className="brand-mark"
              style={{ width: 40, height: 40, borderRadius: 12, fontSize: 15 }}
            >
              FR
            </span>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Flagraft
            </span>
          </div>

          <div className="auth-pitch">
            <h1>
              Feature flags
              <br />
              without the&nbsp;ceremony.
            </h1>
            <p>
              Self-hosted. Three environments out of the box. Sub-50ms evaluations from any region.
            </p>
          </div>

          <div className="auth-stats">
            <div>
              <div className="num">{workspaceInfo?.flagCount ?? '—'}</div>
              <div className="lbl">flags · {workspaceInfo?.projectName ?? 'this project'}</div>
            </div>
            <div>
              <div className="num">
                98<span className="unit">%</span>
              </div>
              <div className="lbl">cache hit · last 24h</div>
            </div>
            <div>
              <div className="num">
                42<span className="unit">ms</span>
              </div>
              <div className="lbl">p99 eval · prod</div>
            </div>
          </div>

          <div className="auth-status">
            <span className="auth-status-dot" />
            All systems operational
            <span
              className="muted"
              style={{ marginLeft: 'auto', fontSize: 11.5, fontFamily: 'var(--font-mono)' }}
            >
              v1.4.2
            </span>
          </div>
        </div>
      </aside>

      {/* Form column */}
      <main className="auth-main">
        <div className="auth-topbar">
          <span className="muted" style={{ fontSize: 12.5 }}>
            New to Flagraft?
          </span>
          <Button size="sm" variant="ghost" rightIcon="arrowRight">
            Create workspace
          </Button>
        </div>

        <div className="auth-form-wrap">
          <div className="auth-form">
            <header className="auth-form-head">
              <h2>{headingText}</h2>
              <p className="muted">{subtitleText}</p>
            </header>

            {magicSent ? (
              <div className="auth-magic-sent">
                <div className="ill">
                  <Icon name="check" size={22} />
                </div>
                <h3>
                  Check <span className="mono">{email}</span>
                </h3>
                <p className="muted">
                  If an account exists, you'll receive a sign-in link shortly. The link expires in
                  10 minutes.
                </p>
                <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMagicSent(false)
                      setMode('password')
                    }}
                  >
                    Use password instead
                  </Button>
                  <Button variant="ghost" onClick={() => setMagicSent(false)}>
                    Resend
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => void handleSubmit(e)} noValidate>
                {/* Social / SSO quick-access buttons */}
                <div className="auth-sso-stack">
                  <button type="button" className="auth-sso-btn" onClick={notifyComingSoon}>
                    <GoogleG />
                    <span>Continue with Google</span>
                  </button>
                  <button type="button" className="auth-sso-btn" onClick={notifyComingSoon}>
                    <Icon name="shield" size={16} />
                    <span>Continue with SAML SSO</span>
                    {ssoDomain ? (
                      <span className="auth-sso-meta mono">{ssoDomain.name.toLowerCase()}.com</span>
                    ) : null}
                  </button>
                </div>

                <div className="auth-divider">
                  <span>or with email</span>
                </div>

                {/* Email field */}
                <div className="field">
                  <label htmlFor="auth-email">Work email</label>
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
                    {ssoDomain ? (
                      <Tip tip={`This workspace uses ${ssoDomain.method}`}>
                        <span className="auth-sso-pill">
                          <Icon name="shield" size={10} /> sso
                        </span>
                      </Tip>
                    ) : null}
                  </div>
                </div>

                {/* Password field - only shown in password mode */}
                {mode === 'password' ? (
                  <div className="field">
                    <label htmlFor="auth-pw" style={{ display: 'flex' }}>
                      <span>Password</span>
                      <span className="spacer" />
                      <a href="#" onClick={(ev) => ev.preventDefault()} className="auth-link">
                        Forgot?
                      </a>
                    </label>
                    <div className="auth-input-wrap">
                      <Icon name="key" size={14} className="ic" />
                      <input
                        id="auth-pw"
                        ref={pwRef}
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
                        <span className="sr-only">
                          {showPw ? 'Hide password' : 'Show password'}
                        </span>
                      </button>
                    </div>
                    {capsOn ? (
                      <span className="hint" style={{ color: 'var(--acc-fg)' }}>
                        <Icon name="alert" size={11} /> Caps Lock is on
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {/* Error alert */}
                {error ? (
                  <div
                    role="alert"
                    className="err"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Icon name="alert" size={13} />
                    {error}
                  </div>
                ) : null}

                {/* Submit button */}
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
                  ) : mode === 'magic' ? (
                    'Send sign-in link'
                  ) : (
                    'Sign in'
                  )}
                </Button>

                <div className="auth-altmode">
                  {mode === 'password' ? (
                    <button
                      type="button"
                      className="auth-link"
                      onClick={() => {
                        setMode('magic')
                        setError(null)
                      }}
                    >
                      <Icon name="sparkles" size={12} /> Email me a sign-in link instead
                    </button>
                  ) : (
                    <button type="button" className="auth-link" onClick={() => setMode('password')}>
                      <Icon name="arrowRight" size={12} style={{ transform: 'rotate(180deg)' }} />{' '}
                      Use password instead
                    </button>
                  )}
                </div>
              </form>
            )}

            <footer className="auth-form-foot">
              <span className="mono" style={{ fontSize: 11 }}>
                Self-hosted&nbsp;·&nbsp;
                <span style={{ color: 'var(--pri-fg)' }}>flagraft.kocharsoft.internal</span>
              </span>
              <span className="spacer" />
              <a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>
                Docs
              </a>
              <a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>
                Status
              </a>
              <a href="#" className="auth-link" onClick={(e) => e.preventDefault()}>
                Privacy
              </a>
            </footer>
          </div>
        </div>
      </main>
    </div>
  )
}
