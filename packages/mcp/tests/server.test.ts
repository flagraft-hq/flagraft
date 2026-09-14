import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, createServer, readConfig, type Config } from '../src/server.js'

const config: Config = { url: 'http://localhost:3000', apiKey: 'ff_test' }

const fetchMock = vi.fn()

/** Replies with a JSON body and the given status, the way Fastify does. */
function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    text: async () => JSON.stringify(body),
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The recorded fetch call, narrowed to the shape `api` actually sends. */
function callAt(index: number) {
  const [url, init] = fetchMock.mock.calls[index] as [
    string,
    { headers: Record<string, string>; body?: string },
  ]
  return { url, init }
}

describe('readConfig', () => {
  it('throws without an API key, rather than serving tools that all 401', () => {
    expect(() => readConfig({})).toThrow(/FLAGRAFT_API_KEY/)
  })

  it('defaults the url and strips a trailing slash', () => {
    expect(readConfig({ FLAGRAFT_API_KEY: 'k' }).url).toBe('http://localhost:3000')
    expect(readConfig({ FLAGRAFT_API_KEY: 'k', FLAGRAFT_URL: 'https://f.co/' }).url).toBe(
      'https://f.co',
    )
  })
})

describe('api', () => {
  it('sends the key as the Authorization header', async () => {
    fetchMock.mockResolvedValue(reply(200, { data: [] }))
    await api(config, 'GET', '/api/v1/admin/projects')

    const { url, init } = callAt(0)
    expect(url).toBe('http://localhost:3000/api/v1/admin/projects')
    expect(init.headers.Authorization).toBe('ff_test')
    expect(init.body).toBeUndefined()
  })

  it('serialises a body and sets the content type', async () => {
    fetchMock.mockResolvedValue(reply(201, { key: 'a' }))
    await api(config, 'POST', '/x', { key: 'a' })

    const { init } = callAt(0)
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"key":"a"}')
  })

  it("surfaces the server's own error message", async () => {
    fetchMock.mockResolvedValue(
      reply(404, { error: 'NotFound', message: 'Flag not found', statusCode: 404 }),
    )
    await expect(api(config, 'GET', '/x')).rejects.toThrow(/\(404\): Flag not found/)
  })
})

/** Drives the server the way a real client does, over the in-memory transport. */
async function connect() {
  const client = new Client({ name: 'test', version: '0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([
    createServer(config).connect(serverTransport),
    client.connect(clientTransport),
  ])
  return client
}

describe('tools', () => {
  it('exposes the read and write tools, and no delete', async () => {
    const client = await connect()
    const names = (await client.listTools()).tools.map((t) => t.name).sort()

    expect(names).toEqual([
      'create_flag',
      'get_flag',
      'list_environments',
      'list_flags',
      'list_projects',
      'list_strategies',
      'set_flag_state',
    ])
  })

  it('list_flags passes only the filters that were given', async () => {
    fetchMock.mockResolvedValue(reply(200, { data: [], total: 0 }))
    const client = await connect()

    await client.callTool({
      name: 'list_flags',
      arguments: { projectId: '11111111-1111-1111-1111-111111111111', search: 'checkout' },
    })

    expect(callAt(0).url).toBe(
      'http://localhost:3000/api/v1/admin/projects/11111111-1111-1111-1111-111111111111/flags?search=checkout',
    )
  })

  it('set_flag_state hits enable or disable depending on the boolean', async () => {
    fetchMock.mockResolvedValue(reply(200, { applied: true }))
    const client = await connect()
    const args = {
      projectId: '11111111-1111-1111-1111-111111111111',
      flagKey: 'new-checkout',
      environmentSlug: 'production',
    }

    await client.callTool({ name: 'set_flag_state', arguments: { ...args, enabled: true } })
    await client.callTool({ name: 'set_flag_state', arguments: { ...args, enabled: false } })

    expect(callAt(0).url).toMatch(/environments\/production\/enable$/)
    expect(callAt(1).url).toMatch(/environments\/production\/disable$/)
  })

  it('reports a pending approval verbatim instead of claiming success', async () => {
    fetchMock.mockResolvedValue(
      reply(200, { applied: false, requestedEnabled: true, requestedBy: 'nikhil' }),
    )
    const client = await connect()

    const result = (await client.callTool({
      name: 'set_flag_state',
      arguments: {
        projectId: '11111111-1111-1111-1111-111111111111',
        flagKey: 'new-checkout',
        environmentSlug: 'production',
        enabled: true,
      },
    })) as { isError?: boolean; content: { text: string }[] }

    expect(result.isError).toBeFalsy()
    expect(JSON.parse(result.content[0].text)).toMatchObject({ applied: false })
  })

  it('returns a failed call as a tool error, not a thrown exception', async () => {
    fetchMock.mockResolvedValue(
      reply(403, { error: 'Forbidden', message: 'Key cannot access project', statusCode: 403 }),
    )
    const client = await connect()

    const result = (await client.callTool({
      name: 'get_flag',
      arguments: { projectId: '11111111-1111-1111-1111-111111111111', flagKey: 'x' },
    })) as { isError?: boolean; content: { text: string }[] }

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Key cannot access project')
  })

  it('rejects a non-uuid project id before any request is made', async () => {
    const client = await connect()

    const result = (await client.callTool({
      name: 'get_flag',
      arguments: { projectId: 'not-a-uuid', flagKey: 'x' },
    })) as { isError?: boolean }

    expect(result.isError).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
