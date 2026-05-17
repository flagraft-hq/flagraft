import { Button } from '../primitives/Button'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import type { Override } from '../../lib/types'

interface OverrideRowProps {
  override: Override
  onEdit: (override: Override) => void
  onDelete: (id: string) => void
}

export function OverrideRow({ override, onEdit, onDelete }: OverrideRowProps) {
  const relativeDate = useRelativeDate(override.created)

  return (
    <div className="override-row">
      <span className="override-key">{override.key}</span>
      <span className="override-op">{override.op}</span>
      <span className="override-val">{override.val}</span>
      <span className={`override-result override-result-${override.result ? 'on' : 'off'}`}>
        {override.result ? 'Enabled' : 'Disabled'}
      </span>
      {override.note ? <span className="override-note">{override.note}</span> : null}
      <span className="override-age">{relativeDate}</span>
      <Button variant="ghost" size="sm" onClick={() => onEdit(override)}>
        Edit
      </Button>
      <Button variant="danger" size="sm" onClick={() => onDelete(override.id)}>
        Delete
      </Button>
    </div>
  )
}
