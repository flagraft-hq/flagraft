import type { StrategyVariant } from '../../db/schema.js'
import type { EvalContext } from './evaluate.js'

const VARIANT_SEED = 86028157

/** MurmurHash3 x86 32-bit over UTF-8 bytes; Unleash buckets with this, so the output must not drift. */
export function murmur3(key: string, seed: number): number {
  const data = Buffer.from(key, 'utf8')
  const len = data.length
  const blocks = len - (len & 3)
  let h = seed >>> 0

  for (let i = 0; i < blocks; i += 4) {
    let k = data.readUInt32LE(i)
    k = Math.imul(k, 0xcc9e2d51)
    k = (k << 15) | (k >>> 17)
    k = Math.imul(k, 0x1b873593)
    h ^= k
    h = (h << 13) | (h >>> 19)
    h = (Math.imul(h, 5) + 0xe6546b64) | 0
  }

  let k = 0
  if ((len & 3) === 3) k ^= data[blocks + 2] << 16
  if ((len & 3) >= 2) k ^= data[blocks + 1] << 8
  if ((len & 3) >= 1) {
    k ^= data[blocks]
    k = Math.imul(k, 0xcc9e2d51)
    k = (k << 15) | (k >>> 17)
    k = Math.imul(k, 0x1b873593)
    h ^= k
  }

  h ^= len
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

const unleashRandom = () => String(Math.round(Math.random() * 100000))

function stickinessValue(stickiness: string, context: EvalContext, random: () => string): string {
  if (stickiness === 'random') return random()
  if (stickiness === 'default') {
    return context.userId || context.sessionId || context.remoteAddress || random()
  }
  return context[stickiness] || random()
}

/** Same walk as unleash-client-node's selectVariantDefinition, so imported users keep their variant. */
export function selectVariant(
  groupId: string,
  variants: StrategyVariant[],
  context: EvalContext,
  random: () => string = unleashRandom,
): StrategyVariant | null {
  const total = variants.reduce((sum, variant) => sum + variant.weight, 0)
  if (total <= 0) return null

  const id = stickinessValue(variants[0].stickiness, context, random)
  const target = (murmur3(`${groupId}:${id}`, VARIANT_SEED) % total) + 1

  let counter = 0
  for (const variant of variants) {
    if (variant.weight === 0) continue
    counter += variant.weight
    if (counter >= target) return variant
  }
  return null
}
