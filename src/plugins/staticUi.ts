import { existsSync } from 'node:fs'
import path from 'node:path'

import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

/** Where the Docker build puts the admin UI. Absent in dev, where Vite serves it. */
export const UI_DIR = path.resolve(process.cwd(), 'public')

export function uiIsBundled(dir: string = UI_DIR): boolean {
  return existsSync(path.join(dir, 'index.html'))
}

export interface StaticUiOptions {
  dir?: string
}

async function staticUiPlugin(fastify: FastifyInstance, opts: StaticUiOptions) {
  const root = opts.dir ?? UI_DIR
  if (!uiIsBundled(root)) return

  await fastify.register(fastifyStatic, { root, wildcard: false })

  /** The UI is a single-page app, so its own routes must survive a refresh. */
  fastify.setNotFoundHandler((request, reply) => {
    const isApi = request.url.startsWith('/api/')
    const wantsHtml = request.headers.accept?.includes('text/html') ?? false
    if (request.method === 'GET' && wantsHtml && !isApi) {
      return reply.sendFile('index.html')
    }
    return reply
      .status(404)
      .send({ error: 'NotFound', message: 'Route not found', statusCode: 404 })
  })
}

export default fp(staticUiPlugin, { name: 'static-ui' })
