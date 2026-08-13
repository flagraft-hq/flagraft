import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

/**
 * A response slower than this is worth a line on its own. Well above what a
 * cached evaluation takes, so a healthy server stays silent.
 */
const SLOW_RESPONSE_MS = 500

/**
 * Logs the requests worth reading instead of all of them.
 *
 * Fastify's built-in logging writes two lines for every request, which on the
 * client evaluation endpoint means thousands of lines a second describing
 * nothing going wrong -- the endpoint is polled by every SDK instance on a
 * timer, so its traffic is closer to a metrics scrape than to page views.
 * That firehose is switched off in the server options; this hook keeps the
 * exceptions: anything the server itself got wrong, and anything that took
 * too long.
 *
 * Set REQUEST_LOG=true to turn the full per-request log back on while
 * debugging, which also disables this hook so nothing is logged twice.
 */
async function requestLogPlugin(fastify: FastifyInstance) {
  fastify.addHook('onResponse', (request, reply, done) => {
    const elapsed = reply.elapsedTime
    /**
     * Only 5xx counts as failure here. A 4xx is the caller being told no --
     * an unauthenticated page load probing /auth/me, a stale bookmark, a
     * typo'd flag key -- and the caller already has that answer in their
     * response. The error handler records those at debug for whoever wants
     * them; warning on every one only trains people to ignore warnings.
     */
    const failed = reply.statusCode >= 500
    if (!failed && elapsed < SLOW_RESPONSE_MS) return done()

    request.log[failed ? 'error' : 'info'](
      {
        req: { method: request.method, url: request.url },
        statusCode: reply.statusCode,
        responseTime: Math.round(elapsed),
      },
      failed ? 'request failed' : 'slow request',
    )
    done()
  })
}

export default fp(requestLogPlugin, { name: 'request-log' })
