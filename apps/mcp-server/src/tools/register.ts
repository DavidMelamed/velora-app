import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

/**
 * Wrapper for McpServer.tool() that avoids TS2589 deep type instantiation
 * caused by complex zod schema inference in the MCP SDK generics.
 */
export function registerTool(
  server: McpServer,
  name: string,
  description: string,
  schema: Record<string, unknown>,
  handler: (params: any) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
) {
  ;(server as any).tool(name, description, schema, handler)
}
