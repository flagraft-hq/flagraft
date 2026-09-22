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
import { cacheKeys } from '../cache/keys.js'
import type { Db } from '../db/index.js'
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

/**
 * True when the context may write to a protected environment: an API key
 * (no role) or a workspace admin (owner/admin) session. Editors are the only
 * ones fenced out. Shared by requireEnvironmentWrite and by flag creation,
 * which must not let a project's "default on" setting auto-enable a
 * protected environment for an editor.
 */
export function canBypassEnvironmentProtection(context: KeyContext): boolean {
  return context.userRole === undefined || WORKSPACE_ADMIN_ROLES.has(context.userRole)
}

/**
 * Identifies who is behind a request, for actions that need to tell two
 * different actors apart (e.g. the two-distinct-admin production approval
 * rule). `userId` is only set for a browser session; anything else is an API
 * key, identified by its own row id since it has no user behind it.
 */
export async function resolveActorLabel(
  db: Db,
  context: KeyContext,
): Promise<{ identity: string; label: string }> {
  if (context.userId) {
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, context.userId))
      .limit(1)
    return { identity: `user:${context.userId}`, label: user?.name ?? 'Unknown user' }
  }

  const [key] = await db
    .select({ description: apiKeys.description, prefix: apiKeys.keyPrefix })
    .from(apiKeys)
    .where(eq(apiKeys.id, context.keyId))
    .limit(1)
  return {
    identity: `key:${context.keyId}`,
    label: key?.description?.trim() || `API key ${key?.prefix ?? context.keyId.slice(0, 8)}`,
  }
}

/**
 * The fields of an API key the request path actually needs. Only primitives
 * are kept because the cache may store the value serialized, which would turn
 * a Date back into a string -- expiresAt is held as epoch milliseconds so it
 * survives that either way.
 */
interface CachedApiKey {
  id: string
  projectId: string | null
  environmentId: string | null
  type: ApiKeyType
  expiresAt: number | null
}

async function loadApiKey(db: Db, keyHash: string): Promise<CachedApiKey | null> {
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1)
  if (!key) return null
  return {
    id: key.id,
    projectId: key.projectId,
    environmentId: key.environmentId,
    type: key.type as ApiKeyType,
    expiresAt: key.expiresAt?.getTime() ?? null,
  }
}

/**
 * When each key last had its lastUsedAt column written, in epoch milliseconds.
 * Every request used to write it, and because all traffic for one key targets
 * one row, those writes queued behind each other and capped the whole server's
 * throughput. Recording it at most once a minute per key is all the column is
 * read at anyway.
 */
const lastUsedWrites = new Map<string, number>()
const LAST_USED_WRITE_INTERVAL_MS = 60_000

function shouldRecordUsage(keyId: string): boolean {
  const now = Date.now()
  const previous = lastUsedWrites.get(keyId)
  if (previous !== undefined && now - previous < LAST_USED_WRITE_INTERVAL_MS) return false
  /** Grows with the number of API keys, not with traffic. */
  lastUsedWrites.set(keyId, now)
  return true
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    if (request.routeOptions.config?.skipAuth) return

    /**
     * Everything that needs a caller lives under /api/. Swagger UI and the
     * bundled admin UI register routes this hook cannot set config on.
     */
    if (!request.url.startsWith('/api/')) return

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

    const keyHash = hashKey(authorization)
    const key = await fastify.cache.getOrSet(cacheKeys.apiKey(keyHash), () =>
      loadApiKey(fastify.db, keyHash),
    )

    if (!key) {
      throw new AppError('Invalid authorization key', 401, 'Unauthorized')
    }

    if (key.expiresAt !== null && key.expiresAt <= Date.now()) {
      throw new AppError('API key expired', 401, 'Unauthorized')
    }

    request.keyContext = {
      keyId: key.id,
      projectId: key.projectId,
      environmentId: key.environmentId,
      type: key.type,
      isRoot: key.projectId === null,
    }

    if (shouldRecordUsage(key.id)) {
      void fastify.db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(and(eq(apiKeys.id, key.id), eq(apiKeys.keyHash, keyHash)))
        .catch((error: unknown) => request.log.warn({ error }, 'Failed to update key usage'))
    }
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

      if (canBypassEnvironmentProtection(request.keyContext!)) return

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
