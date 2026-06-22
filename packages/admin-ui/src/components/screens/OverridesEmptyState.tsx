import { Button } from '../primitives/Button'

interface OverridesEmptyStateProps {
  onAdd: () => void
  /** When provided, the heading names the environment being viewed. */
  envName?: string
}

export function OverridesEmptyState({ onAdd, envName }: OverridesEmptyStateProps) {
  return (
    <div className="overrides-empty">
      <div className="overrides-empty-ill" aria-hidden="true">
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none">
          <circle cx="34" cy="34" r="26" fill="var(--bg-subtle)" stroke="var(--border)" />
          <circle cx="34" cy="34" r="16" fill="var(--bg-elev)" stroke="var(--border-strong)" />
          <circle cx="34" cy="34" r="6" fill="var(--pri-soft)" stroke="var(--pri)" />
          <circle cx="34" cy="34" r="2" fill="var(--pri)" />
        </svg>
      </div>
      <h3 className="overrides-empty-title">
        {envName ? <>No overrides in {envName}</> : 'No overrides yet'}
      </h3>
      <p className="overrides-empty-desc">
        Every caller in this environment gets the default. Add an override to flip the result for a
        specific tenant, user, or segment.
      </p>
      <div className="overrides-empty-actions">
        <Button variant="primary" leftIcon="plus" onClick={onAdd}>
          Add your first override
        </Button>
      </div>
    </div>
  )
}
