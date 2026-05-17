import { Icon } from '../primitives/Icon'
import { Button } from '../primitives/Button'

interface OverridesEmptyStateProps {
  onAdd: () => void
}

export function OverridesEmptyState({ onAdd }: OverridesEmptyStateProps) {
  return (
    <div className="overrides-empty">
      <Icon name="target" size={40} />
      <p className="overrides-empty-title">No overrides yet</p>
      <p className="overrides-empty-desc">
        Context overrides let you target specific users or groups.
      </p>
      <Button variant="primary" leftIcon="plus" onClick={onAdd}>
        Add Override
      </Button>
    </div>
  )
}
