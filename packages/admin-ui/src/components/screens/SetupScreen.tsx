import { useState } from 'react'
import { Button } from '../primitives/Button'
import logoImg from '../../assets/logo.png'

/**
 * Temporary screen shown when the app redirects to /login before Phase 9 auth is built.
 * Lets the user enter an admin API key so the app can connect to the backend.
 * Replaced entirely by the real LoginScreen in Phase 9.
 */
export function SetupScreen() {
  const [key, setKey] = useState(sessionStorage.getItem('flagraft_api_key') ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleConnect() {
    if (!key.trim()) {
      setError('Enter your admin API key.')
      return
    }
    sessionStorage.setItem('flagraft_api_key', key.trim())
    window.location.href = '/'
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="brand" style={{ marginBottom: 24 }}>
          <img src={logoImg} alt="Flagraft Logo" className="brand-logo" style={{ height: '4rem', marginLeft: '-0.875rem', marginRight: '-0.625rem' }} />
          <span style={{ fontSize: '1.0625rem', fontWeight: 700 }}>Flagraft</span>
        </div>
        <h1 className="setup-title">Connect to backend</h1>
        <p className="setup-sub">
          Enter your admin API key to get started. Find it in your server configuration.
        </p>
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}
        <div className="setup-field">
          <label htmlFor="setup-key" className="setup-label">
            Admin API key
          </label>
          <input
            id="setup-key"
            className="input"
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConnect()
            }}
            placeholder="ff_..."
            autoFocus
          />
        </div>
        <Button
          variant="primary"
          onClick={handleConnect}
          disabled={!key.trim()}
          className="setup-submit"
        >
          Connect
        </Button>
      </div>
    </div>
  )
}
