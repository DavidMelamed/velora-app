import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

/**
 * Start an HTTP transport for the MCP server using Streamable HTTP.
 * This exposes the MCP server over HTTP for network access.
 */
export async function startHttpTransport(server: McpServer, port: number = 4100) {
  const app = express()
  app.use(express.json())

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      server: 'velora-mcp',
      transport: 'streamable-http',
      timestamp: new Date().toISOString(),
    })
  })

  // MCP endpoint using Streamable HTTP transport
  app.all('/mcp', async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      })
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (error) {
      console.error('[MCP HTTP] Error handling request:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  })

  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.error(`[MCP HTTP] Velora MCP server listening on http://localhost:${port}/mcp`)
      resolve()
    })
  })
}
