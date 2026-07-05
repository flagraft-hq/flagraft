import { Icon } from './Icon'

/**
 * Inline error banner for forms and dialogs. Renders nothing when there is no
 * message, so callers can pass their error state directly. Use this instead of
 * relying only on a toast when the failure happened inside a form the user is
 * looking at.
 */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <div className="form-error-banner" role="alert">
      <Icon name="alert" size={14} />
      <span>{message}</span>
    </div>
  )
}
