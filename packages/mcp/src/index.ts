import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createServer, readConfig } from './server.js'

/**
 * Stdio is the only transport here: an MCP server for a self-hosted tool runs
 * on the developer's own machine next to the agent, so there is nothing for an
 * HTTP transport to reach that a local process cannot.
 */
async function main() {
  const server = createServer(readConfig())
  await server.connect(new StdioServerTransport())
}

main().catch((error: unknown) => {
  /** stderr, never stdout -- stdout is the MCP protocol channel. */
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
