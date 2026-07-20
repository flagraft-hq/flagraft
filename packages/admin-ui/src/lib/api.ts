import axios from 'axios'

import type { UserRole } from './roles'
import type { Flag, ContextField, Project, Env, ApiKey, ApiKeyType, CreatedApiKey } from './types'

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

export const flagsApi = {
  list: (projectId: string) => http.get<Flag[]>(`/api/v1/admin/projects/${projectId}/flags`),

  get: (projectId: string, key: string) =>
    http.get<Flag>(`/api/v1/admin/projects/${projectId}/flags/${key}`),

  /**
   * The backend has separate enable/disable endpoints instead of a single PATCH.
   */
  toggle: (projectId: string, key: string, env: string, enabled: boolean) =>
    http.post(
      `/api/v1/admin/projects/${projectId}/flags/${key}/environments/${env}/${enabled ? 'enable' : 'disable'}`,
    ),

  create: (projectId: string, data: { key: string; name: string; description?: string }) =>
    http.post<Flag>(`/api/v1/admin/projects/${projectId}/flags`, data),

  update: (
    projectId: string,
    key: string,
    data: Partial<Pick<Flag, 'name' | 'description' | 'tags'>>,
  ) => http.patch<Flag>(`/api/v1/admin/projects/${projectId}/flags/${key}`, data),

  delete: (projectId: string, key: string) =>
    http.delete(`/api/v1/admin/projects/${projectId}/flags/${key}`),
}

export const contextFieldsApi = {
  list: (projectId: string) =>
    http.get<ContextField[]>(`/api/v1/admin/projects/${projectId}/context-fields`),
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

export const keysApi = {
  list: (projectId: string) => http.get<ApiKey[]>(`/api/v1/admin/projects/${projectId}/keys`),

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
  lastActiveAt: string | null
  createdAt: string
  projects: string[]
}

export const workspaceApi = {
  /** Public -- no auth required. Used by the login screen brand panel. */
  info: () =>
    http.get<{ projectName: string | null; flagCount: number }>('/api/v1/public/workspace'),
}

export const usersApi = {
  list: () => http.get<WorkspaceUser[]>('/api/v1/admin/users'),

  get: (id: string) =>
    http.get<WorkspaceUser & { projects: { id: string; name: string }[] }>(
      `/api/v1/admin/users/${id}`,
    ),

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
