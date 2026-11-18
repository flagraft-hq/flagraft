import { VARIANT_WEIGHT_TOTAL } from './limits'
import type { StrategyVariant, VariantPayloadType } from './types'

export interface DraftVariant {
  name: string
  fixed: boolean
  /** What the user typed for a fixed weight, in percent. Unused while the weight is automatic. */
  percent: string
  payloadType: VariantPayloadType | ''
  payloadValue: string
}

export const EMPTY_VARIANT: DraftVariant = {
  name: '',
  fixed: false,
  percent: '',
  payloadType: '',
  payloadValue: '',
}

/** Null when the text is not a percentage from 0 to 100. */
export function percentToWeight(percent: string): number | null {
  const value = Number(percent)
  if (percent.trim() === '' || !Number.isFinite(value) || value < 0 || value > 100) return null
  return Math.round(value * 10)
}

export function formatPercent(weight: number): string {
  return `${weight / 10}%`
}

/**
 * Previews the weights the server will store: a number is a fixed weight, null is automatic.
 * Mirrors normaliseVariants in src/modules/strategies/variant-rules.ts -- keep the two in sync.
 */
export function fillWeights(fixedWeights: (number | null)[]): number[] | null {
  const fixTotal = fixedWeights.reduce<number>((sum, weight) => sum + (weight ?? 0), 0)
  const variableCount = fixedWeights.filter((weight) => weight === null).length
  if (fixTotal > VARIANT_WEIGHT_TOTAL) return null
  if (variableCount === 0 && fixedWeights.length > 0 && fixTotal !== VARIANT_WEIGHT_TOTAL) {
    return null
  }

  const remaining = VARIANT_WEIGHT_TOTAL - fixTotal
  const share = variableCount > 0 ? Math.floor(remaining / variableCount) : 0
  let extra = variableCount > 0 ? remaining % variableCount : 0
  return fixedWeights.map((weight) => weight ?? share + (extra-- > 0 ? 1 : 0))
}

export function toDraftVariant(variant: StrategyVariant): DraftVariant {
  const fixed = variant.weightType === 'fix'
  return {
    name: variant.name,
    fixed,
    percent: fixed ? String(variant.weight / 10) : '',
    payloadType: variant.payload?.type ?? '',
    payloadValue: variant.payload?.value ?? '',
  }
}
