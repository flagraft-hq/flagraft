/**
 * Load-tests the client evaluation endpoints against a running server.
 * Run seed.ts first -- it writes the client key this reads.
 *
 * Usage: pnpm bench:server
 */
import autocannon from 'autocannon'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CONFIG_PATH = fileURLToPath(new URL('.bench.json', import.meta.url))
const CONNECTIONS = Number(process.env.BENCH_CONNECTIONS ?? 50)
const DURATION = Number(process.env.BENCH_DURATION ?? 10)

interface BenchConfig {
  baseUrl: string
  clientKey: string
  etag: string
  flagCount: number
}

function loadConfig(): BenchConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as BenchConfig
  } catch {
    throw new Error(`${CONFIG_PATH} missing. Run pnpm bench:seed first.`)
  }
}

async function run(title: string, url: string, headers: Record<string, string>) {
  const result = await autocannon({
    title,
    url,
    headers,
    connections: CONNECTIONS,
    duration: DURATION,
  })
  return {
    scenario: title,
    'req/s': Math.round(result.requests.average),
    'p50 ms': result.latency.p50,
    'p99 ms': result.latency.p99,
    '2xx': result['2xx'],
    '3xx': result['3xx'],
    errors: result.non2xx - result['3xx'],
  }
}

async function main() {
  const config = loadConfig()
  const auth = { authorization: config.clientKey }
  const all = `${config.baseUrl}/api/v1/client/features`

  const rows = []
  rows.push(await run('all flags (cache hit)', all, auth))
  rows.push(await run('all flags (304)', all, { ...auth, 'if-none-match': config.etag }))
  rows.push(await run('single flag', `${all}/bench-flag-0`, auth))

  console.log(`\n${config.flagCount} flags, ${CONNECTIONS} connections, ${DURATION}s each`)
  console.table(rows)

  /**
   * A rate-limited or failing run still produces a high req/s number, which
   * reads like a good result. Saying so outright stops that.
   */
  const broken = rows.filter((r) => r.errors > 0)
  if (broken.length > 0) {
    console.error(
      `\nNon-2xx responses in: ${broken.map((r) => r.scenario).join(', ')}. ` +
        'These numbers are meaningless -- most likely RATE_LIMIT_MAX is throttling the run.',
    )
    process.exit(1)
  }
}

void main().catch((error: unknown) => {
  console.error((error as Error).message)
  process.exit(1)
})
