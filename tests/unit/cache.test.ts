import { describe, expect, it, vi } from 'vitest'
import { createCache } from '../../src/cache/index.js'

describe('createCache', () => {
  it('calls factory once on first access', async () => {
    const cache = createCache(30)
    const factory = vi.fn().mockResolvedValue({ data: 'value' })

    const result = await cache.getOrSet('k1', factory)

    expect(result).toEqual({ data: 'value' })
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('returns cached value without calling factory on second access', async () => {
    const cache = createCache(30)
    const factory = vi.fn().mockResolvedValue('fresh')

    await cache.getOrSet('k2', factory)
    const second = await cache.getOrSet('k2', factory)

    expect(second).toBe('fresh')
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('calls factory again after delete', async () => {
    const cache = createCache(30)
    const factory = vi.fn().mockResolvedValue('value')

    await cache.getOrSet('k3', factory)
    await cache.delete('k3')
    await cache.getOrSet('k3', factory)

    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('deleteByPrefix removes all matching keys', async () => {
    const cache = createCache(30)
    const factory = vi.fn().mockResolvedValue('x')

    await cache.getOrSet('project:a:env1', factory)
    await cache.getOrSet('project:a:env2', factory)
    await cache.getOrSet('project:b:env1', factory)

    await cache.deleteByPrefix('project:a:')

    /** project:a keys are gone -- factory called again (2 more calls) */
    await cache.getOrSet('project:a:env1', factory)
    await cache.getOrSet('project:a:env2', factory)
    /** project:b still cached -- factory NOT called again */
    await cache.getOrSet('project:b:env1', factory)

    /** 3 initial + 2 re-fetched for project:a = 5 */
    expect(factory).toHaveBeenCalledTimes(5)
  })

  it('calls factory again after TTL expiry', async () => {
    const cache = createCache(1) // 1-second TTL
    const factory = vi.fn().mockResolvedValue('v')

    await cache.getOrSet('k4', factory)

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 1100))

    await cache.getOrSet('k4', factory)
    expect(factory).toHaveBeenCalledTimes(2)
  })
})
