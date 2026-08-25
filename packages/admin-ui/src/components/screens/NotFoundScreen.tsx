import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../primitives/Button'
import { ErrorScreen } from './ErrorScreen'

/**
 * Shown for any URL that matches no route, signed in or not -- the route does
 * not exist for anyone, and the route table ships in the bundle regardless, so
 * there is nothing to hide behind the login screen. Only the way out changes.
 */
export function NotFoundScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <ErrorScreen
      code="404"
      icon="search"
      title="Page not found"
      message="That URL does not match anything here. It may have been renamed, or the link that brought you here may be out of date."
      actions={
        <>
          {user ? (
            <Button variant="primary" leftIcon="flag" onClick={() => navigate('/flags')}>
              Go to flags
            </Button>
          ) : (
            <Button variant="primary" leftIcon="user" onClick={() => navigate('/login')}>
              Go to sign in
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </>
      }
    />
  )
}
