import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export interface Config {
  /** Base URL of the Flagraft server, no trailing slash. */
  url: string
  /** A root or project admin key. Client keys cannot read the admin API. */
  apiKey: string
}

/**
 * Reads the server URL and API key from the environment. Throws on a missing
 * key rather than starting a server whose every tool would fail with a 401.
 */
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.FLAGRAFT_API_KEY
  if (!apiKey) {
    throw new Error('FLAGRAFT_API_KEY is required (a root or project admin key)')
  }
  return {
    url: (env.FLAGRAFT_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
    apiKey,
  }
}

/**
 * Calls the Flagraft admin API. A non-2xx response is turned into an Error
 * carrying the server's own message, because that message is the only useful
 * thing an agent can act on.
 */
export async function api(
  config: Config,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`${config.url}${path}`, {
    method,
    headers: {
      Authorization: config.apiKey,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  const text = await response.text()
  const payload = text ? safeParse(text) : null

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : text || response.statusText
    throw new Error(`${method} ${path} failed (${response.status}): ${message}`)
  }

  return payload
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const rendered = search.toString()
  return rendered ? `?${rendered}` : ''
}

type ToolResult = {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

/** Every tool answers with pretty JSON, which is what an agent reads best. */
const ok = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
})

/**
 * A failed call comes back as a tool error rather than a thrown exception, so
 * the agent sees what went wrong and can correct itself instead of the whole
 * conversation dying on a typo'd project id.
 */
export async function run(handler: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return ok(await handler())
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    }
  }
}

const projectId = z.string().uuid().describe('Project UUID, from list_projects')
const flagKey = z.string().min(1).describe('Flag key as used in code')
const environmentSlug = z.string().min(1).describe('Environment slug, e.g. production')

/**
 * The tool surface is deliberately small: read projects, environments, flags
 * and targeting, plus create a flag and turn one on or off. Deleting anything
 * is left out -- an agent that can drop a project is a worse trade than a
 * human opening the admin UI for the rare delete.
 */
export function registerTools(server: McpServer, config: Config): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'List every Flagraft project this API key can see, with their ids and slugs.',
      annotations: { readOnlyHint: true },
    },
    () => run(() => api(config, 'GET', '/api/v1/admin/projects')),
  )

  server.registerTool(
    'list_environments',
    {
      title: 'List environments',
      description: "List a project's environments. Use the slug when toggling a flag.",
      inputSchema: { projectId },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      run(() => api(config, 'GET', `/api/v1/admin/projects/${args.projectId}/environments`)),
  )

  server.registerTool(
    'list_flags',
    {
      title: 'List flags',
      description:
        'List flags in a project. Each flag carries its on/off state per environment. ' +
        'Use search to find a flag by name, key or description before creating a duplicate.',
      inputSchema: {
        projectId,
        search: z.string().min(1).optional().describe('Match against name, key and description'),
        env: z.string().min(1).optional().describe('Environment slug required by `state`'),
        state: z.enum(['on', 'off']).optional().describe('Filter by state within `env`'),
        limit: z.number().int().min(1).max(100).optional().describe('Page size, default 25'),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ projectId: id, ...rest }) =>
      run(() => api(config, 'GET', `/api/v1/admin/projects/${id}/flags${query(rest)}`)),
  )

  server.registerTool(
    'get_flag',
    {
      title: 'Get flag',
      description: 'Get one flag by key, including its state in every environment.',
      inputSchema: { projectId, flagKey },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      run(() =>
        api(config, 'GET', `/api/v1/admin/projects/${args.projectId}/flags/${args.flagKey}`),
      ),
  )

  server.registerTool(
    'create_flag',
    {
      title: 'Create flag',
      description:
        'Create a feature flag. The key is permanent and is what the code calls, so pick it ' +
        'carefully. The flag starts off in every environment; enable it with set_flag_state.',
      inputSchema: {
        projectId,
        key: z.string().min(1).describe('Stable identifier used in code, cannot be changed later'),
        name: z.string().min(1).describe('Display name'),
        description: z.string().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    ({ projectId: id, ...body }) =>
      run(() => api(config, 'POST', `/api/v1/admin/projects/${id}/flags`, body)),
  )

  server.registerTool(
    'set_flag_state',
    {
      title: 'Enable or disable a flag',
      description:
        'Turn a flag on or off in one environment. On a protected environment that requires ' +
        'approval the change is recorded as pending instead of applied, and the response says ' +
        'so with `applied: false` -- report that back rather than treating it as done.',
      inputSchema: { projectId, flagKey, environmentSlug, enabled: z.boolean() },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    (args) =>
      run(() =>
        api(
          config,
          'POST',
          `/api/v1/admin/projects/${args.projectId}/flags/${args.flagKey}` +
            `/environments/${args.environmentSlug}/${args.enabled ? 'enable' : 'disable'}`,
        ),
      ),
  )

  server.registerTool(
    'list_strategies',
    {
      title: 'List targeting strategies',
      description:
        'Read the ordered targeting strategies for a flag in one environment. Answers ' +
        '"who is this flag actually on for". Strategies are read-only here; edit them in the admin UI.',
      inputSchema: { projectId, flagKey, environmentSlug },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      run(() =>
        api(
          config,
          'GET',
          `/api/v1/admin/projects/${args.projectId}/flags/${args.flagKey}` +
            `/environments/${args.environmentSlug}/strategies`,
        ),
      ),
  )
}

export function createServer(config: Config): McpServer {
  const server = new McpServer({ name: 'flagraft', version: '0.0.1' })
  registerTools(server, config)
  return server
}
