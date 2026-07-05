import type { FastifyInstance, FastifyReply } from 'fastify'

export const SESSION_COOKIE = 'flagraft_session'

export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
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
  reply.setCookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTS)
}
