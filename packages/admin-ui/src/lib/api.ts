import axios from 'axios'
import type { Flag, Override, ContextField, Project } from './types'

/**
 * Axios instance for API calls.
 * Uses VITE_API_URL or defaults to localhost.
 */
const http = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

/**
 * Injects the API key from session storage as the Authorization header.
 * Uses sessionStorage so the key is cleared when the browser tab closes.
 * The backend reads request.headers.authorization and hashes it directly.
 */
http.interceptors.request.use((config) => {
  const key = sessionStorage.getItem('flagraft_api_key')
  if (key) config.headers['Authorization'] = key
  return config
})

/**
 * Global response handler.
 * Clears credentials and redirects to /login on 401 Unauthorized errors.
 */
http.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      sessionStorage.removeItem('flagraft_api_key')
      window.location.href = '/login'
    }
    return Promise.reject(err instanceof Error ? err : new Error(String(err)))
  },
)

export { http }

export const flagsApi = {
  list: (projectId: string) =>
    http.get<Flag[]>(`/api/v1/admin/projects/${projectId}/flags`),

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

export const overridesApi = {
  /**
   * env is now a URL path segment, not a query param.
   */
  list: (projectId: string, flagKey: string, env: string) =>
    http.get<Override[]>(
      `/api/v1/admin/projects/${projectId}/flags/${flagKey}/environments/${env}/overrides`,
    ),

  create: (
    projectId: string,
    flagKey: string,
    env: string,
    data: Omit<Override, 'id' | 'flag' | 'env' | 'created'>,
  ) =>
    http.post<Override>(
      `/api/v1/admin/projects/${projectId}/flags/${flagKey}/environments/${env}/overrides`,
      data,
    ),

  delete: (projectId: string, flagKey: string, env: string, id: string) =>
    http.delete(
      `/api/v1/admin/projects/${projectId}/flags/${flagKey}/environments/${env}/overrides/${id}`,
    ),
}

export const contextFieldsApi = {
  list: (projectId: string) =>
    http.get<ContextField[]>(`/api/v1/admin/projects/${projectId}/context-fields`),
}

export const projectsApi = {
  list: () => http.get<Project[]>('/api/v1/admin/projects'),

  get: (id: string) => http.get<Project>(`/api/v1/admin/projects/${id}`),

  create: (data: { name: string; slug: string; description?: string }) =>
    http.post<Project>('/api/v1/admin/projects', data),
}
