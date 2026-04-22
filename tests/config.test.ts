import { describe, expect, it } from 'vitest'

import { loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow('Invalid configuration')
  })

  it('returns a frozen config with defaults', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://veltra:veltra@localhost:5432/veltra'
    })

    expect(config).toMatchObject({
      DATABASE_URL: 'postgres://veltra:veltra@localhost:5432/veltra',
      PORT: 3000,
      NODE_ENV: 'development',
      LOG_LEVEL: 'info'
    })
    expect(Object.isFrozen(config)).toBe(true)
  })
})
