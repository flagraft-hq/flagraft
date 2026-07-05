import { describe, expect, it } from 'vitest'

import { loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow('Invalid configuration')
  })

  it('returns a frozen config with defaults', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
      JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
    })

    expect(config).toMatchObject({
      DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
      PORT: 3000,
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      CACHE_TTL_SECONDS: 30,
    })
    expect(Object.isFrozen(config)).toBe(true)
  })

  it('defaults CACHE_TTL_SECONDS to 30', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
      JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
    })
    expect(config.CACHE_TTL_SECONDS).toBe(30)
  })

  it('accepts a custom CACHE_TTL_SECONDS', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
      JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
      CACHE_TTL_SECONDS: '60',
    })
    expect(config.CACHE_TTL_SECONDS).toBe(60)
  })

  it('rejects a non-numeric CACHE_TTL_SECONDS', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
        JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
        CACHE_TTL_SECONDS: 'bad',
      }),
    ).toThrow('Invalid configuration')
  })

  it('refuses the default admin password in production', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
        JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
        NODE_ENV: 'production',
      }),
    ).toThrow('DEFAULT_ADMIN_PASSWORD')

    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
        JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
        NODE_ENV: 'production',
        DEFAULT_ADMIN_PASSWORD: 'flagraft-admin',
      }),
    ).toThrow('DEFAULT_ADMIN_PASSWORD')
  })

  it('accepts a custom admin password in production', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
      JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
      NODE_ENV: 'production',
      DEFAULT_ADMIN_PASSWORD: 'a-strong-unique-password',
    })
    expect(config.DEFAULT_ADMIN_PASSWORD).toBe('a-strong-unique-password')
  })

  it('rejects CACHE_TTL_SECONDS of 0', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgres://flagraft:flagraft@localhost:5432/flagraft',
        JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
        CACHE_TTL_SECONDS: '0',
      }),
    ).toThrow('Invalid configuration')
  })
})
