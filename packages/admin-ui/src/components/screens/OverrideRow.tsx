import { Icon } from '../primitives/Icon'
import { Tip } from '../primitives/Tip'
import { useRelativeDate } from '../../hooks/useRelativeDate'
import { OPS_BY_TYPE } from '../../lib/types'
import type { Override } from '../../lib/types'

interface OverrideRowProps {
  override: Override
  /** 0-based position, rendered as a zero-padded ordinal (01, 02, …). */
  index?: number
  onEdit: (override: Override) => void
  onDelete: (id: string) => void
}

/** Human-readable operator label, e.g. "startsWith" → "starts with". */
function operatorLabel(op: string): string {
  for (const ops of Object.values(OPS_BY_TYPE)) {
    const match = ops.find((o) => o.value === op)
    if (match) return match.label
  }
  return op
}

export function OverrideRow({ override, index = 0, onEdit, onDelete }: OverrideRowProps) {
  const relativeDate = useRelativeDate(override.created)
  const isList = override.val.includes(',')

  return (
    <div className="ctx-ovr-row">
      <span className="ord mono">{String(index + 1).padStart(2, '0')}</span>

      <div className="rule">
        <span className="kw">if</span>
        <span className="ctx-key mono">{override.key}</span>
        <span className="op">{operatorLabel(override.op)}</span>
        <span className="val mono">{isList ? override.val : `“${override.val}”`}</span>
        <span className="kw arrow">→</span>
        <span className={`result ${override.result ? 'on' : 'off'}`}>
          <span className="dot" />
          {override.result ? 'ON' : 'OFF'}
        </span>
      </div>

      <div className="meta">
        {override.note ? (
          <span className="note" title={override.note}>
            {override.note}
          </span>
        ) : null}
        <span className="override-age mono">
          <Icon name="history" size={11} />
          {relativeDate}
        </span>
      </div>

      <div className="actions">
        <Tip tip="Edit override">
          <button className="icon-btn" aria-label="Edit override" onClick={() => onEdit(override)}>
            <Icon name="edit" size={13} />
          </button>
        </Tip>
        <Tip tip="Delete override">
          <button
            className="icon-btn danger"
            aria-label="Delete override"
            onClick={() => onDelete(override.id)}
          >
            <Icon name="trash" size={13} />
          </button>
        </Tip>
      </div>
    </div>
  )
}
