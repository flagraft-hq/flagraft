import { useNavigate } from 'react-router-dom'

import { Button } from '../primitives/Button'
import { ErrorScreen } from './ErrorScreen'

interface ForbiddenScreenProps {
  /** What the current role is missing, e.g. "manage API keys". */
  action?: string
}

/**
 * Shown when someone signed in reaches a route their role cannot use. It says
 * 403 rather than 404 on purpose: the page exists, they just cannot open it,
 * and the route list ships in the bundle anyway so there is nothing to hide.
 */
export function ForbiddenScreen({ action = 'open this page' }: ForbiddenScreenProps) {
  const navigate = useNavigate()

  return (
    <ErrorScreen
      code="403"
      icon="shield"
      title="You don't have access"
      message={`Your role cannot ${action}. Ask an owner or an admin if you need it.`}
      actions={
        <>
          <Button variant="primary" leftIcon="flag" onClick={() => navigate('/flags')}>
            Go to flags
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </>
      }
    />
  )
}
