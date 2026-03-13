import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerCrashTools } from './tools/crash-tools'
import { registerIntersectionTools } from './tools/intersection-tools'
import { registerAttorneyTools } from './tools/attorney-tools'
import { registerEqualizerTools } from './tools/equalizer-tools'
import { registerTrendTools } from './tools/trend-tools'
import { startHttpTransport } from './transports/http'

const TOOL_LIST = [
  'health',
  'search_crashes',
  'get_crash_details',
  'get_nearby_crashes',
  'get_intersection_safety',
  'get_dangerous_intersections',
  'find_attorneys',
  'get_attorney_profile',
  'compare_attorneys',
  'generate_equalizer',
  'get_equalizer',
  'get_crash_trends',
  'get_seasonal_patterns',
]

const server = new McpServer({
  name: 'velora-mcp',
  version: '0.1.0',
})

// ─── Health tool ────────────────────────────────────────────────────────────────

server.tool(
  'health',
  'Check Velora MCP server health status',
  {},
  async () => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          status: 'ok',
          server: 'velora-mcp',
          version: '0.1.0',
          timestamp: new Date().toISOString(),
          toolCount: TOOL_LIST.length,
          tools: TOOL_LIST,
        }),
      },
    ],
  })
)

// ─── Register all tool groups ───────────────────────────────────────────────────

registerCrashTools(server)
registerIntersectionTools(server)
registerAttorneyTools(server)
registerEqualizerTools(server)
registerTrendTools(server)

// ─── Server startup ─────────────────────────────────────────────────────────────

type TransportType = 'stdio' | 'http'

function getTransportType(): TransportType {
  const args = process.argv.slice(2)
  const transportIdx = args.indexOf('--transport')
  if (transportIdx !== -1 && args[transportIdx + 1]) {
    const value = args[transportIdx + 1]
    if (value === 'http' || value === 'stdio') return value
  }
  return 'stdio'
}

function getHttpPort(): number {
  const args = process.argv.slice(2)
  const portIdx = args.indexOf('--port')
  if (portIdx !== -1 && args[portIdx + 1]) {
    const value = parseInt(args[portIdx + 1], 10)
    if (!isNaN(value)) return value
  }
  return parseInt(process.env.MCP_PORT || '4100', 10)
}

async function main() {
  const transportType = getTransportType()

  if (transportType === 'http') {
    const port = getHttpPort()
    await startHttpTransport(server, port)
    console.error(`[MCP] Velora MCP server running on HTTP port ${port} with ${TOOL_LIST.length} tools`)
  } else {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error(`[MCP] Velora MCP server running on stdio with ${TOOL_LIST.length} tools`)
  }
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error)
  process.exit(1)
})

export { server }
