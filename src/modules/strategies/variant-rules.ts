import type { StrategyVariant, VariantPayload } from '../../db/schema.js'
import {
  MAX_VARIANT_NAME_LENGTH,
  MAX_VARIANT_PAYLOAD_LENGTH,
  MAX_VARIANTS_PER_STRATEGY,
  VARIANT_WEIGHT_TOTAL,
} from '../../limits.js'

export interface VariantInput {
  name: string
  weight?: number
  weightType?: 'variable' | 'fix'
  stickiness?: string
  payload?: VariantPayload
}

export type VariantResult = { variants: StrategyVariant[] } | { error: string }

function payloadError(name: string, payload: VariantPayload): string | null {
  if (payload.value.length > MAX_VARIANT_PAYLOAD_LENGTH) {
    return `Variant "${name}": payload is longer than ${MAX_VARIANT_PAYLOAD_LENGTH} characters`
  }
  if (payload.type === 'json') {
    try {
      JSON.parse(payload.value)
    } catch {
      return `Variant "${name}": payload is not valid JSON`
    }
  }
  if (payload.type === 'number') {
    if (payload.value.trim() === '' || !Number.isFinite(Number(payload.value))) {
      return `Variant "${name}": payload is not a number`
    }
  }
  return null
}

/** Returns a reason instead of throwing so the importer can drop and report, like constraint-rules. */
export function normaliseVariants(input: VariantInput[]): VariantResult {
  if (input.length === 0) return { variants: [] }
  if (input.length > MAX_VARIANTS_PER_STRATEGY) {
    return { error: `A strategy can have at most ${MAX_VARIANTS_PER_STRATEGY} variants` }
  }

  const stickiness = input[0].stickiness ?? 'default'
  const names = new Set<string>()
  let fixTotal = 0
  let variableCount = 0

  for (const variant of input) {
    if (variant.name.length === 0 || variant.name.length > MAX_VARIANT_NAME_LENGTH) {
      return { error: `Variant names must be 1-${MAX_VARIANT_NAME_LENGTH} characters` }
    }
    if (names.has(variant.name)) return { error: `Duplicate variant name: "${variant.name}"` }
    names.add(variant.name)

    if ((variant.stickiness ?? 'default') !== stickiness) {
      return { error: 'All variants in a strategy must use the same stickiness' }
    }

    if (variant.weightType === 'fix') {
      const weight = variant.weight
      if (
        weight === undefined ||
        !Number.isInteger(weight) ||
        weight < 0 ||
        weight > VARIANT_WEIGHT_TOTAL
      ) {
        return {
          error: `Variant "${variant.name}": a fixed weight must be an integer from 0 to ${VARIANT_WEIGHT_TOTAL}`,
        }
      }
      fixTotal += weight
    } else {
      variableCount += 1
    }

    if (variant.payload) {
      const error = payloadError(variant.name, variant.payload)
      if (error) return { error }
    }
  }

  if (fixTotal > VARIANT_WEIGHT_TOTAL) {
    return { error: `Fixed weights total ${fixTotal}, which is more than ${VARIANT_WEIGHT_TOTAL}` }
  }
  if (variableCount === 0 && fixTotal !== VARIANT_WEIGHT_TOTAL) {
    return {
      error: `Fixed weights total ${fixTotal}; with no variable variants they must total ${VARIANT_WEIGHT_TOTAL}`,
    }
  }

  const remaining = VARIANT_WEIGHT_TOTAL - fixTotal
  const share = variableCount > 0 ? Math.floor(remaining / variableCount) : 0
  let extra = variableCount > 0 ? remaining % variableCount : 0

  const variants = input.map((variant): StrategyVariant => {
    const fixed = variant.weightType === 'fix'
    const weight = fixed ? variant.weight! : share + (extra-- > 0 ? 1 : 0)
    return {
      name: variant.name,
      weight,
      weightType: fixed ? 'fix' : 'variable',
      stickiness,
      ...(variant.payload ? { payload: variant.payload } : {}),
    }
  })
  return { variants }
}
