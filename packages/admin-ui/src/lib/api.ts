import axios from 'axios'

import type { UserRole } from './roles'
import type {
  Flag,
  ContextField,
  ContextFieldInput,
  Strategy,
  StrategyConstraint,
  Project,
  ProjectSettings,
  Env,
  ApiKey,
  ApiKeyType,
  CreatedApiKey,
  Page,
} from './types'

/** Carries the HTTP status alongside the server-provided message. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Axios instance for API calls.
 * Uses VITE_API_URL or defaults to localhost.
 * withCredentials ensures the flagraft_session cookie is sent on every request.
 */
const http = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
  withCredentials: true,
})

/**
 * Global response handler.
 * Extracts the human-readable server message from the response body so
 * components never have to parse AxiosError themselves.
 * Redirects to /login on 401 Unauthorized.
 */
http.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 0
      const path = window.location.pathname
      /** The invite-accept page is public; a 401 there must not bounce to login. */
      if (status === 401 && path !== '/login' && !path.startsWith('/invite/')) {
        window.location.href = '/login'
      }
      const data = err.response?.data as
        | { message?: string; issues?: { message: string }[] }
        | undefined
      const msg = data?.issues?.[0]?.message ?? data?.message ?? err.message
      return Promise.reject(new ApiError(msg, status))
    }
    return Promise.reject(err instanceof Error ? err : new Error(String(err)))
  },
)

export { http }

export interface ListFlagsParams {
  limit: number
  offset: number
  search?: string
  /** Only meaningful together with `env`. */
  state?: 'on' | 'off'
  env?: string
  sort?: 'name' | 'key' | 'updated'
  dir?: 'asc' | 'desc'
}

export const flagsApi = {
  list: (projectId: string, params: ListFlagsParams) =>
    http.get<Page<Flag>>(`/api/v1/admin/projects/${projectId}/flags`, { params }),

  get: (projectId: string, key: string) =>
    http.get<Flag>(`/api/v1/admin/projects/${projectId}/flags/${key}`),

  /**
   * The backend has separate enable/disable endpoints instead of a single PATCH.
   * When the project requires approval in prod, a lone confirmation doesn't
   * apply yet -- the response is 202 with `pending: true` instead of the
   * updated flag-environment row.
   */
  toggle: (projectId: string, key: string, env: string, enabled: boolean) =>
    http.post<{ pending?: boolean; requestedEnabled?: boolean; requestedBy?: string }>(
      `/api/v1/admin/projects/${projectId}/flags/${key}/environments/${env}/${enabled ? 'enable' : 'disable'}`,
    ),

  create: (projectId: string, data: { key: string; name: string; description?: string }) =>
    http.post<Flag>(`/api/v1/admin/projects/${projectId}/flags`, data),

  update: (projectId: string, key: string, data: Partial<Pick<Flag, 'name' | 'description'>>) =>
    http.patch<Flag>(`/api/v1/admin/projects/${projectId}/flags/${key}`, data),

  delete: (projectId: string, key: string) =>
    http.delete(`/api/v1/admin/projects/${projectId}/flags/${key}`),
}

export const contextFieldsApi = {
  list: (projectId: string) =>
    http.get<ContextField[]>(`/api/v1/admin/projects/${projectId}/context-fields`),

  create: (projectId: string, data: ContextFieldInput) =>
    http.post<ContextField>(`/api/v1/admin/projects/${projectId}/context-fields`, data),

  /** `key` is immutable, so it is not part of the update payload. */
  update: (projectId: string, fieldId: string, data: Omit<ContextFieldInput, 'key'>) =>
    http.patch<ContextField>(`/api/v1/admin/projects/${projectId}/context-fields/${fieldId}`, data),

  delete: (projectId: string, fieldId: string) =>
    http.delete(`/api/v1/admin/projects/${projectId}/context-fields/${fieldId}`),
}

export const strategiesApi = {
  list: (projectId: string, flagKey: string, env: string) =>
    http.get<Strategy[]>(
      `/api/v1/admin/projects/${projectId}/flags/${flagKey}/environments/${env}/strategies`,
    ),

  /** Replaces the whole ordered list for this flag+environment. */
  replace: (
    projectId: string,
    flagKey: string,
    env: string,
    strategies: { constraints: StrategyConstraint[] }[],
  ) =>
    http.put<Strategy[]>(
      `/api/v1/admin/projects/${projectId}/flags/${flagKey}/environments/${env}/strategies`,
      { strategies },
    ),
}

export const environmentsApi = {
  list: (projectId: string) => http.get<Env[]>(`/api/v1/admin/projects/${projectId}/environments`),

  create: (projectId: string, data: { name: string; slug: string; protected: boolean }) =>
    http.post<Env>(`/api/v1/admin/projects/${projectId}/environments`, data),

  update: (
    projectId: string,
    environmentId: string,
    data: Partial<Pick<Env, 'name' | 'protected'>>,
  ) => http.patch<Env>(`/api/v1/admin/projects/${projectId}/environments/${environmentId}`, data),

  delete: (projectId: string, environmentId: string) =>
    http.delete(`/api/v1/admin/projects/${projectId}/environments/${environmentId}`),
}

export interface ListKeysParams {
  limit: number
  offset: number
  /** Matched against the label and the key prefix. */
  search?: string
  type?: ApiKeyType
  environmentId?: string
  sort?: 'created' | 'lastUsed' | 'label'
  dir?: 'asc' | 'desc'
}

export const keysApi = {
  list: (projectId: string, params: ListKeysParams) =>
    http.get<Page<ApiKey>>(`/api/v1/admin/projects/${projectId}/keys`, { params }),

  /** Returns the plaintext key once; the backend only ever stores its hash. */
  create: (
    projectId: string,
    data: { type: ApiKeyType; environmentId?: string; description?: string },
  ) => http.post<CreatedApiKey>(`/api/v1/admin/projects/${projectId}/keys`, data),

  delete: (projectId: string, keyId: string) =>
    http.delete(`/api/v1/admin/projects/${projectId}/keys/${keyId}`),
}

export const projectsApi = {
  list: () => http.get<Project[]>('/api/v1/admin/projects'),

  get: (id: string) => http.get<Project>(`/api/v1/admin/projects/${id}`),

  create: (data: { name: string; slug: string; description?: string }) =>
    http.post<Project>('/api/v1/admin/projects', data),

  update: (id: string, data: { name?: string; description?: string; settings?: ProjectSettings }) =>
    http.patch<Project>(`/api/v1/admin/projects/${id}`, data),

  /** Owner-only on the server; takes the project's flags, environments and keys with it. */
  delete: (id: string) => http.delete(`/api/v1/admin/projects/${id}`),
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<AuthUser>('/api/v1/admin/auth/login', { email, password }),

  logout: () => http.post('/api/v1/admin/auth/logout'),

  me: () => http.get<AuthUser>('/api/v1/admin/auth/me'),
}

/** Public invite-acceptance flow -- no session required. */
export const inviteApi = {
  get: (token: string) =>
    http.get<{ email: string; name: string }>(`/api/v1/public/invite/${token}`),

  accept: (token: string, password: string) =>
    http.post<AuthUser>(`/api/v1/public/invite/${token}/accept`, { password }),
}

export interface WorkspaceUser {
  id: string
  email: string
  name: string
  role: UserRole
  status: 'active' | 'invited' | 'suspended'
  isSystem: boolean
  initials: string
  tone: 'teal' | 'amber' | 'violet' | 'slate'
  lastLoginAt: string | null
  createdAt: string
  projects: string[]
}

export const workspaceApi = {
  /** Public -- no auth required. Used by the login screen brand panel. */
  info: () =>
    http.get<{ projectName: string | null; flagCount: number }>('/api/v1/public/workspace'),
}

/** Workspace-wide bucket counts for the Users screen chips and stat cards. */
export interface UserCounts {
  all: number
  active: number
  invited: number
  suspended: number
  system: number
  owners: number
  admins: number
}

export interface ListUsersParams {
  limit: number
  offset: number
  search?: string
  status?: 'active' | 'invited' | 'suspended' | 'system'
  role?: string
  /** Restricts the list to members of one project. */
  projectId?: string
  sort?: 'name' | 'role' | 'projects' | 'last'
  dir?: 'asc' | 'desc'
}

export type UserWithProjects = Omit<WorkspaceUser, 'projects'> & {
  projects: { id: string; name: string }[]
}

export const usersApi = {
  list: (params: ListUsersParams) =>
    http.get<Page<WorkspaceUser> & { counts: UserCounts }>('/api/v1/admin/users', { params }),

  /**
   * The detail endpoint returns full project objects where list rows carry
   * just the names, so `projects` is replaced rather than intersected.
   */
  get: (id: string) => http.get<UserWithProjects>(`/api/v1/admin/users/${id}`),

  invite: (emails: string[], role: string, projectIds: string[]) =>
    http.post<
      { id: string; email: string; inviteUrl: string; expiresAt: string; emailed: boolean }[]
    >('/api/v1/admin/users/invite', { emails, role, projectIds }),

  patch: (id: string, data: Partial<Pick<WorkspaceUser, 'role' | 'status' | 'name'>>) =>
    http.patch<WorkspaceUser>(`/api/v1/admin/users/${id}`, data),

  resetPassword: (id: string, password: string) =>
    http.post(`/api/v1/admin/users/${id}/reset-password`, { password }),

  resendInvite: (id: string) =>
    http.post<{
      id: string
      email: string
      inviteUrl: string
      expiresAt: string
      emailed: boolean
    }>(`/api/v1/admin/users/${id}/resend-invite`),

  delete: (id: string) => http.delete(`/api/v1/admin/users/${id}`),

  /** Cancels a pending invite only; the server refuses if the user is active. */
  cancelInvite: (id: string) => http.delete(`/api/v1/admin/users/${id}/invite`),

  addToProject: (id: string, projectId: string) =>
    http.post(`/api/v1/admin/users/${id}/projects/${projectId}`),

  removeFromProject: (id: string, projectId: string) =>
    http.delete(`/api/v1/admin/users/${id}/projects/${projectId}`),
}
