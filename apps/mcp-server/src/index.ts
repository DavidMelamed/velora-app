import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerCrashTools } from './tools/crash-tools'
import { registerIntersectionTools } from './tools/intersection-tools'
import { registerAttorneyTools } from './tools/attorney-tools'
import { registerEqualizerTools } from './tools/equalizer-tools'
import { registerTrendTools } from './tools/trend-tools'

const server = new McpServer({
  name: 'velora-mcp',
  version: '0.1.0',
})

// ─── Health tool ────────────────────────────────────────────────────────────────

server.tool(
  'health',
  'Check Velora MCP server health status',
  {},
  async () => {
    const toolList = [
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
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            status: 'ok',
            server: 'velora-mcp',
            version: '0.1.0',
            timestamp: new Date().toISOString(),
            toolCount: toolList.length,
            tools: toolList,
          }),
        },
      ],
    }
  }
)

// ─── Register all tool groups ───────────────────────────────────────────────────

registerCrashTools(server)
registerIntersectionTools(server)
registerAttorneyTools(server)
registerEqualizerTools(server)
registerTrendTools(server)

// ─── Server startup ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[MCP] Velora MCP server running on stdio with 13 tools')
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error)
  process.exit(1)
})

export { server }
