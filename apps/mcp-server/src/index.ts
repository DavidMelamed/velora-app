import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({
  name: 'velora-mcp',
  version: '0.0.0',
})

// Health tool — always available for testing connectivity
server.tool(
  'health',
  'Check Velora MCP server health status',
  {},
  async () => {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            status: 'ok',
            server: 'velora-mcp',
            version: '0.0.0',
            timestamp: new Date().toISOString(),
            tools: ['health'],
          }),
        },
      ],
    }
  }
)

// Server startup
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[MCP] Velora MCP server running on stdio')
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error)
  process.exit(1)
})
