import { MAX_VARIANTS_PER_STRATEGY } from '../../lib/limits'
import { EMPTY_VARIANT, fillWeights, percentToWeight, type DraftVariant } from '../../lib/variants'
import type { VariantPayloadType } from '../../lib/types'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import { Select } from '../primitives/Select'

const PAYLOAD_OPTIONS = [
  { value: '', label: 'No payload' },
  { value: 'string', label: 'String' },
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
  { value: 'number', label: 'Number' },
]

interface StrategyVariantsEditorProps {
  variants: DraftVariant[]
  stickiness: string
  contextFieldKeys: string[]
  onVariantsChange: (variants: DraftVariant[]) => void
  onStickinessChange: (stickiness: string) => void
}

export function StrategyVariantsEditor({
  variants,
  stickiness,
  contextFieldKeys,
  onVariantsChange,
  onStickinessChange,
}: StrategyVariantsEditorProps) {
  const weights = fillWeights(
    variants.map((variant) => (variant.fixed ? (percentToWeight(variant.percent) ?? 0) : null)),
  )

  /** A stickiness saved earlier may name a context field that has since been removed; keep it selectable. */
  const stickinessKeys = Array.from(new Set(['default', 'random', ...contextFieldKeys, stickiness]))

  function patch(index: number, change: Partial<DraftVariant>) {
    onVariantsChange(
      variants.map((variant, i) => (i === index ? { ...variant, ...change } : variant)),
    )
  }

  return (
    <div className="strat-variants">
      {variants.length > 0 && (
        <div className="strat-variants-head">
          <span className="strat-variants-title">Variants</span>
          <span className="spacer" />
          <Select
            aria-label="Stickiness"
            options={stickinessKeys.map((key) => ({ value: key, label: `Sticky on: ${key}` }))}
            value={stickiness}
            placeholder=""
            onChange={onStickinessChange}
          />
        </div>
      )}

      {variants.map((variant, index) => {
        const label = `Variant ${index + 1}`
        const autoPercent = weights ? String(weights[index] / 10) : ''
        return (
          <div key={index} className="strat-variant">
            <input
              className="text-field-input"
              aria-label={`${label} name`}
              placeholder="Name"
              value={variant.name}
              onChange={(e) => patch(index, { name: e.target.value })}
            />
            <div className="strat-variant-weight">
              <input
                className="text-field-input"
                aria-label={`${label} weight`}
                inputMode="decimal"
                value={variant.fixed ? variant.percent : autoPercent}
                disabled={!variant.fixed}
                onChange={(e) => patch(index, { percent: e.target.value })}
              />
              <span className="muted">%</span>
            </div>
            <label className="strat-variant-fixed">
              <input
                type="checkbox"
                aria-label={`${label} fixed weight`}
                checked={variant.fixed}
                onChange={(e) =>
                  patch(index, {
                    fixed: e.target.checked,
                    percent: e.target.checked ? autoPercent : '',
                  })
                }
              />
              Fixed
            </label>
            <Select
              aria-label={`${label} payload type`}
              options={PAYLOAD_OPTIONS}
              value={variant.payloadType}
              placeholder=""
              onChange={(type) => patch(index, { payloadType: type as VariantPayloadType | '' })}
            />
            <input
              className="text-field-input"
              aria-label={`${label} payload`}
              placeholder="Payload value"
              value={variant.payloadValue}
              disabled={variant.payloadType === ''}
              onChange={(e) => patch(index, { payloadValue: e.target.value })}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove variant ${index + 1}`}
              onClick={() => onVariantsChange(variants.filter((_, i) => i !== index))}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        )
      })}

      <Button
        size="sm"
        variant="ghost"
        leftIcon="plus"
        className="strat-add-condition"
        disabled={variants.length >= MAX_VARIANTS_PER_STRATEGY}
        onClick={() => onVariantsChange([...variants, { ...EMPTY_VARIANT }])}
      >
        Add variant
      </Button>
    </div>
  )
}
