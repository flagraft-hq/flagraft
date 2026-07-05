import { Icon } from './Icon'
import { Button } from './Button'

interface ErrorStateProps {
  title: string
  message: string
  onRetry?: () => void
}

/**
 * Displays an error heading, message, and optional retry action.
 */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="error-state-icon" aria-hidden="true">
        <Icon name="alert" size={32} />
      </div>
      <h2 className="error-state-title">{title}</h2>
      <p className="error-state-message">{message}</p>
      {onRetry ? (
        <div className="error-state-action">
          <Button variant="ghost" leftIcon="refresh" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  )
}
