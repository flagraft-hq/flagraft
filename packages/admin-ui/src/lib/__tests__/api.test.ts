import axios, { AxiosError } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  http,
  flagsApi,
  overridesApi,
  contextFieldsApi,
  projectsApi,
  authApi,
  usersApi,
  ApiError,
} from '../api'

/** Builds a minimal AxiosError with the given status and response body. */
function makeAxiosError(status: number, data?: unknown): AxiosError {
  const err = new AxiosError(`Request failed with status code ${status}`)
  err.response = {
    status,
    data,
    headers: {},
    config: {} as InternalAxiosRequestConfig,
    statusText: String(status),
  } as AxiosResponse
  return err
}

/** Resolves the registered interceptor error handler from the http instance. */
function getInterceptorErrorHandler(): (err: unknown) => Promise<never> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  return (http.interceptors.response as any).handlers[0].rejected as (
    err: unknown,
  ) => Promise<never>
}

describe('http instance', () => {
  it('is an axios instance', () => {
    expect(axios.isAxiosError).toBeDefined()
    expect(http.defaults.timeout).toBe(10_000)
  })
  it('has withCredentials enabled', () => {
    expect(http.defaults.withCredentials).toBe(true)
  })
  it('has response interceptors registered', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    expect((http.interceptors.response as any).handlers.length).toBeGreaterThan(0)
  })
})

describe('response interceptor', () => {
  let handle: (err: unknown) => Promise<never>

  beforeEach(() => {
    handle = getInterceptorErrorHandler()
    vi.stubGlobal('location', { pathname: '/flags', href: '' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses issues[0].message for validation errors', async () => {
    const err = makeAxiosError(400, {
      error: 'ValidationError',
      message: 'Validation error',
      issues: [{ message: 'Invalid email', validation: 'email', path: ['email'] }],
    })
    await expect(handle(err)).rejects.toThrow('Invalid email')
  })

  it('uses data.message when there are no issues', async () => {
    const err = makeAxiosError(409, { error: 'Conflict', message: 'Resource already exists' })
    await expect(handle(err)).rejects.toThrow('Resource already exists')
  })

  it('falls back to the axios message when the response has no body', async () => {
    const err = makeAxiosError(500, undefined)
    await expect(handle(err)).rejects.toThrow('Request failed with status code 500')
  })

  it('throws ApiError with the correct HTTP status', async () => {
    const err = makeAxiosError(409, { message: 'Resource already exists' })
    let caught: unknown
    try {
      await handle(err)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(409)
  })

  it('wraps a network error (no response) as ApiError with status 0', async () => {
    const err = new AxiosError('Network Error')
    let caught: unknown
    try {
      await handle(err)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(0)
  })

  it('redirects to /login on 401 when not already on login page', async () => {
    vi.stubGlobal('location', { pathname: '/flags', href: '' })
    const err = makeAxiosError(401, { message: 'Unauthorized' })
    await handle(err).catch(() => {})
    expect(window.location.href).toBe('/login')
  })

  it('does not redirect on 401 when already on /login', async () => {
    vi.stubGlobal('location', { pathname: '/login', href: '/login' })
    const err = makeAxiosError(401, { message: 'Unauthorized' })
    await handle(err).catch(() => {})
    expect(window.location.href).toBe('/login')
  })

  it('passes non-axios errors through unchanged', async () => {
    const plain = new Error('plain error')
    await expect(handle(plain)).rejects.toBe(plain)
  })

  it('wraps non-Error non-axios values in a plain Error', async () => {
    await expect(handle('oops')).rejects.toThrow('oops')
  })
})

describe('flagsApi', () => {
  it('exports list, get, toggle, create, update, delete', () => {
    expect(typeof flagsApi.list).toBe('function')
    expect(typeof flagsApi.get).toBe('function')
    expect(typeof flagsApi.toggle).toBe('function')
    expect(typeof flagsApi.create).toBe('function')
    expect(typeof flagsApi.update).toBe('function')
    expect(typeof flagsApi.delete).toBe('function')
  })
})

describe('overridesApi', () => {
  it('exports list, create, delete', () => {
    expect(typeof overridesApi.list).toBe('function')
    expect(typeof overridesApi.create).toBe('function')
    expect(typeof overridesApi.delete).toBe('function')
  })
})

describe('contextFieldsApi', () => {
  it('exports list', () => {
    expect(typeof contextFieldsApi.list).toBe('function')
  })
})

describe('projectsApi', () => {
  it('exports list and get', () => {
    expect(typeof projectsApi.list).toBe('function')
    expect(typeof projectsApi.get).toBe('function')
  })

  it('create posts to /api/v1/admin/projects', async () => {
    expect(typeof projectsApi.create).toBe('function')
    const spy = vi.spyOn(http, 'post').mockResolvedValueOnce({ data: {} })
    await projectsApi.create({ name: 'New', slug: 'new' })
    expect(spy).toHaveBeenCalledWith('/api/v1/admin/projects', { name: 'New', slug: 'new' })
    spy.mockRestore()
  })
})

describe('authApi', () => {
  it('exports login, logout, me', () => {
    expect(typeof authApi.login).toBe('function')
    expect(typeof authApi.logout).toBe('function')
    expect(typeof authApi.me).toBe('function')
  })
})

describe('usersApi', () => {
  it('exports list, invite, patch, resetPassword, delete', () => {
    expect(typeof usersApi.list).toBe('function')
    expect(typeof usersApi.invite).toBe('function')
    expect(typeof usersApi.patch).toBe('function')
    expect(typeof usersApi.resetPassword).toBe('function')
    expect(typeof usersApi.delete).toBe('function')
  })
})
