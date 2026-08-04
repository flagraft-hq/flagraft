import { createHash, randomBytes } from 'node:crypto'

import type {} from '@fastify/cookie'
import type {} from '@fastify/jwt'
import { and, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import {
  API_KEY_TYPES,
  READ_ONLY_ROLES,
  USER_ROLES,
  WORKSPACE_ADMIN_ROLES,
  type ApiKeyType,
} from '../auth/constants.js'
import { apiKeys, environments, userProjects, users } from '../db/schema.js'
import { AppError } from './errorHandler.js'

/**
 * Represents the security context derived from an API key or user session
 */
export interface KeyContext {
  keyId: string
  projectId: string | null
  environmentId: string | null
  type: ApiKeyType
  isRoot: boolean
  userId?: string | null
  /** Set only for browser sessions: the user's current role from the database. */
  userRole?: string
}

declare module 'fastify' {
  interface FastifyContextConfig {
    skipAuth?: boolean
  }

  interface FastifyRequest {
    keyContext?: KeyContext
  }

  interface FastifyInstance {
    requireAdminKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireRootKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireProjectAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireOwner: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireEnvironmentWrite: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireClientKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireUserSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

/**
 * Hashes a plaintext API key for secure storage
 */
export function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Generates a new API key with its prefix and hashed value
 */
export function generateKey(): { plaintext: string; prefix: string; hash: string } {
  const plaintext = `ff_${randomBytes(16).toString('hex')}`
  return {
    plaintext,
    prefix: plaintext.slice(0, 12),
    hash: hashKey(plaintext),
  }
}

function projectIdFromParams(request: FastifyRequest): string | undefined {
  const params = request.params
  if (typeof params !== 'object' || params === null || !('projectId' in params)) {
    return undefined
  }

  const value = (params as { projectId?: unknown }).projectId
  return typeof value === 'string' ? value : undefined
}

function environmentSlugFromParams(request: FastifyRequest): string | undefined {
  const params = request.params
  if (typeof params !== 'object' || params === null || !('environmentSlug' in params)) {
    return undefined
  }

  const value = (params as { environmentSlug?: unknown }).environmentSlug
  return typeof value === 'string' ? value : undefined
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    if (request.routeOptions.config?.skipAuth) return

    /**
     * @fastify/swagger-ui registers its routes internally and provides no way to
     * set `config.skipAuth` on them, so the skipAuth flag check above cannot
     * reach those routes. A URL prefix guard is the correct escape hatch.
     */
    if (request.url.startsWith('/docs')) return

    /**
     * Try JWT session cookie first -- used by browser clients (admin UI).
     * The JWT only proves who the user is; role, status, and session validity
     * are checked against the database on every request so suspensions,
     * demotions, and password resets take effect immediately.
     */
    const sessionCookie = request.cookies?.['flagraft_session']
    if (sessionCookie) {
      let payload: { sub: string; sv?: number }
      try {
        payload = fastify.jwt.verify<{ sub: string; sv?: number }>(sessionCookie)
      } catch {
        throw new AppError('Session expired', 401, 'Unauthorized')
      }

      const [user] = await fastify.db.select().from(users).where(eq(users.id, payload.sub)).limit(1)

      if (!user || user.status !== 'active' || payload.sv !== user.sessionVersion) {
        throw new AppError('Session expired', 401, 'Unauthorized')
      }

      request.keyContext = {
        keyId: user.id,
        projectId: null,
        environmentId: null,
        type: API_KEY_TYPES.ADMIN,
        isRoot: WORKSPACE_ADMIN_ROLES.has(user.role),
        userId: user.id,
        userRole: user.role,
      }
      return
    }

    /**
     * Fall back to API key in the Authorization header -- used by SDK clients
     * and the CLI. Looks up the hashed key in the database.
     */
    const authorization = request.headers.authorization
    if (!authorization) {
      throw new AppError('Missing authorization header', 401, 'Unauthorized')
    }

    const [key] = await fastify.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hashKey(authorization)))
      .limit(1)

    if (!key) {
      throw new AppError('Invalid authorization key', 401, 'Unauthorized')
    }

    request.keyContext = {
      keyId: key.id,
      projectId: key.projectId,
      environmentId: key.environmentId,
      type: key.type as ApiKeyType,
      isRoot: key.projectId === null,
    }

    void fastify.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(and(eq(apiKeys.id, key.id), eq(apiKeys.keyHash, key.keyHash)))
      .catch((error: unknown) => request.log.warn({ error }, 'Failed to update key usage'))
  })

  /**
   * Decorator that ensures the request has a valid admin key with proper scope.
   * For browser sessions, non-admin roles are restricted to projects they are
   * members of, and viewers to read-only access.
   */
  fastify.decorate('requireAdminKey', async (request: FastifyRequest) => {
    const context = request.keyContext
    if (!context || context.type !== API_KEY_TYPES.ADMIN) {
      throw new AppError('Admin key required', 403, 'Forbidden')
    }

    const routeProjectId = projectIdFromParams(request)

    if (context.userRole && !context.isRoot) {
      if (
        READ_ONLY_ROLES.has(context.userRole) &&
        request.method !== 'GET' &&
        request.method !== 'HEAD'
      ) {
        throw new AppError('Your role is read-only', 403, 'Forbidden')
      }
      if (routeProjectId) {
        const [membership] = await fastify.db
          .select({ id: userProjects.id })
          .from(userProjects)
          .where(
            and(
              eq(userProjects.userId, context.userId!),
              eq(userProjects.projectId, routeProjectId),
            ),
          )
          .limit(1)
        if (!membership) {
          throw new AppError('You are not a member of this project', 403, 'Forbidden')
        }
      }
      return
    }

    if (routeProjectId && !context.isRoot && context.projectId !== routeProjectId) {
      throw new AppError('Project scope mismatch', 403, 'Forbidden')
    }
  })

  /**
   * Decorator that ensures the request is workspace-admin level: a root admin
   * API key, or a browser session whose user has the owner/admin role.
   */
  fastify.decorate('requireRootKey', async (request: FastifyRequest) => {
    const context = request.keyContext
    if (!context || context.type !== API_KEY_TYPES.ADMIN || !context.isRoot) {
      throw new AppError('Workspace admin access required', 403, 'Forbidden')
    }
  })

  /**
   * Decorator for actions the role matrix reserves for owners and admins:
   * managing environments, issuing API keys and editing project settings.
   * Editors are members of the project but must not reach these, while API
   * keys keep the scope-based access they have always had.
   */
  fastify.decorate('requireProjectAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.requireAdminKey(request, reply)

    const role = request.keyContext!.userRole
    if (role !== undefined && !WORKSPACE_ADMIN_ROLES.has(role)) {
      throw new AppError('Only owners and admins can do this', 403, 'Forbidden')
    }
  })

  /**
   * Decorator for the owner-only row of the role matrix: deleting a project.
   * Admins are workspace administrators but not owners, so they are refused
   * here. A root API key keeps full power because the CLI relies on it.
   */
  fastify.decorate('requireOwner', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.requireAdminKey(request, reply)

    const context = request.keyContext!
    const allowed = context.userRole
      ? context.userRole === USER_ROLES.OWNER
      : /** No role means an API key; only a workspace-wide one qualifies. */
        context.isRoot
    if (!allowed) {
      throw new AppError('Only the workspace owner can do this', 403, 'Forbidden')
    }
  })

  /**
   * Decorator for writes that land in one specific environment: toggling a
   * flag and replacing its targeting. Editors may do this in everyday
   * environments but not in protected ones such as production.
   */
  fastify.decorate(
    'requireEnvironmentWrite',
    async (request: FastifyRequest, reply: FastifyReply) => {
      await fastify.requireAdminKey(request, reply)

      const role = request.keyContext!.userRole
      /** API keys and workspace admins are unrestricted; only editors are fenced. */
      if (role === undefined || WORKSPACE_ADMIN_ROLES.has(role)) return

      const projectId = projectIdFromParams(request)
      const slug = environmentSlugFromParams(request)
      if (!projectId || !slug) return

      const [environment] = await fastify.db
        .select({ protected: environments.protected })
        .from(environments)
        .where(and(eq(environments.projectId, projectId), eq(environments.slug, slug)))
        .limit(1)

      if (environment?.protected) {
        throw new AppError(`Only owners and admins can change flags in ${slug}`, 403, 'Forbidden')
      }
    },
  )

  /**
   * Decorator that ensures the request has a valid client key
   */
  fastify.decorate('requireClientKey', async (request: FastifyRequest) => {
    const context = request.keyContext
    if (!context || context.type !== API_KEY_TYPES.CLIENT) {
      throw new AppError('Client key required', 403, 'Forbidden')
    }
  })

  /**
   * Decorator that ensures the request carries a valid JWT session cookie.
   * Used to protect admin UI routes that should only be accessible to
   * authenticated browser sessions, not API key holders.
   */
  fastify.decorate('requireUserSession', async (request: FastifyRequest) => {
    const token = request.cookies?.['flagraft_session']
    if (!token) throw new AppError('Authentication required', 401, 'Unauthorized')
    try {
      fastify.jwt.verify(token)
    } catch {
      throw new AppError('Session expired', 401, 'Unauthorized')
    }
  })
}

export default fp(authPlugin, { name: 'auth' })
