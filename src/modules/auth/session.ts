import type { FastifyInstance, FastifyReply } from 'fastify'

import type { AppConfig } from '../../config.js'

export const SESSION_COOKIE = 'flagraft_session'

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export function sessionCookieOpts(config: AppConfig) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

interface SessionUser {
  id: string
  email: string
  role: string
  name: string
  sessionVersion: number
}

/**
 * Signs a 7-day session JWT for the user and sets it as the session cookie.
 * Shared by the login route and the invite-accept flow so both log a user in
 * the same way.
 */
export function setSessionCookie(
  fastify: FastifyInstance,
  reply: FastifyReply,
  user: SessionUser,
): void {
  const token = fastify.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      /** Session version: mismatch with the DB invalidates the session. */
      sv: user.sessionVersion,
    },
    { expiresIn: '7d' },
  )
  reply.setCookie(SESSION_COOKIE, token, sessionCookieOpts(fastify.config))
}
