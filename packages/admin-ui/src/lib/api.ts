import axios from 'axios'
import type { Flag, Override, ContextField, Project } from './types'

/**
 * Axios instance for API calls.
 * Uses VITE_API_URL or defaults to localhost.
 */
const http = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

/**
 * Injects the API key from local storage into every request header.
 */
http.interceptors.request.use((config) => {
  const key = localStorage.getItem('flagraft_api_key')
  if (key) config.headers['X-API-Key'] = key
  return config
})

/**
 * Global response handler.
 * Clears credentials and redirects to login on 401 Unauthorized errors.
 */
http.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      localStorage.removeItem('flagraft_api_key')
      window.location.href = '/login'
    }
    return Promise.reject(err instanceof Error ? err : new Error(String(err)))
  },
)

export { http }

export const flagsApi = {
  list: (projectId: string) => http.get<Flag[]>(`/api/v1/projects/${projectId}/flags`),
  get: (projectId: string, key: string) =>
    http.get<Flag>(`/api/v1/projects/${projectId}/flags/${key}`),
  toggle: (projectId: string, key: string, env: string, enabled: boolean) =>
    http.patch(`/api/v1/projects/${projectId}/flags/${key}/envs/${env}`, { enabled }),
  create: (projectId: string, data: { key: string; name: string; description?: string }) =>
    http.post<Flag>(`/api/v1/projects/${projectId}/flags`, data),
  update: (
    projectId: string,
    key: string,
    data: Partial<Pick<Flag, 'name' | 'description' | 'tags'>>,
  ) => http.patch<Flag>(`/api/v1/projects/${projectId}/flags/${key}`, data),
  delete: (projectId: string, key: string) =>
    http.delete(`/api/v1/projects/${projectId}/flags/${key}`),
}

export const overridesApi = {
  list: (projectId: string, flagKey: string, env: string) =>
    http.get<Override[]>(`/api/v1/projects/${projectId}/flags/${flagKey}/overrides`, {
      params: { env },
    }),
  create: (projectId: string, flagKey: string, data: Omit<Override, 'id' | 'flag' | 'created'>) =>
    http.post<Override>(`/api/v1/projects/${projectId}/flags/${flagKey}/overrides`, data),
  update: (
    projectId: string,
    flagKey: string,
    id: string,
    data: Partial<Omit<Override, 'id' | 'flag' | 'created'>>,
  ) => http.patch<Override>(`/api/v1/projects/${projectId}/flags/${flagKey}/overrides/${id}`, data),
  delete: (projectId: string, flagKey: string, id: string) =>
    http.delete(`/api/v1/projects/${projectId}/flags/${flagKey}/overrides/${id}`),
  reorder: (projectId: string, flagKey: string, env: string, ids: string[]) =>
    http.put(`/api/v1/projects/${projectId}/flags/${flagKey}/overrides/order`, { env, ids }),
}

export const contextFieldsApi = {
  list: (projectId: string) =>
    http.get<ContextField[]>(`/api/v1/projects/${projectId}/context-fields`),
}

export const projectsApi = {
  list: () => http.get<Project[]>('/api/v1/projects'),
  get: (id: string) => http.get<Project>(`/api/v1/projects/${id}`),
}
