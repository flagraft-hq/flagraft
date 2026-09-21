import { describe, expect, it, vi } from 'vitest'
import type { FastifyInstance, FastifyReply } from 'fastify'

import type { AppConfig } from '../../src/config.js'
import {
  SESSION_COOKIE,
  sessionCookieOpts,
  setSessionCookie,
} from '../../src/modules/auth/session.js'

const config = (nodeEnv: string) => ({ NODE_ENV: nodeEnv }) as AppConfig

const user = {
  id: 'u1',
  email: 'a@b.c',
  role: 'owner',
  name: 'A',
  sessionVersion: 3,
}

describe('sessionCookieOpts', () => {
  it('marks the cookie Secure in production', () => {
    expect(sessionCookieOpts(config('production')).secure).toBe(true)
  })

  it('leaves it off outside production, so http://localhost still works', () => {
    expect(sessionCookieOpts(config('development')).secure).toBe(false)
    expect(sessionCookieOpts(config('test')).secure).toBe(false)
  })

  it('always keeps the attributes that stop the cookie being read or sent cross-site', () => {
    expect(sessionCookieOpts(config('development'))).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 604800,
    })
  })
})

describe('setSessionCookie', () => {
  function call(nodeEnv: string) {
    const setCookie = vi.fn()
    const sign = vi.fn().mockReturnValue('signed-token')
    const fastify = { config: config(nodeEnv), jwt: { sign } } as unknown as FastifyInstance
    setSessionCookie(fastify, { setCookie } as unknown as FastifyReply, user)
    return { setCookie, sign }
  }

  it('reads the environment from the validated config, not process.env', () => {
    const before = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      const { setCookie } = call('production')
      expect(setCookie).toHaveBeenCalledWith(
        SESSION_COOKIE,
        'signed-token',
        expect.objectContaining({ secure: true }),
      )
    } finally {
      process.env.NODE_ENV = before
    }
  })

  it('carries the session version so a mismatch can invalidate the session', () => {
    const { sign } = call('test')
    expect(sign).toHaveBeenCalledWith(expect.objectContaining({ sub: 'u1', sv: 3 }), {
      expiresIn: '7d',
    })
  })
})
