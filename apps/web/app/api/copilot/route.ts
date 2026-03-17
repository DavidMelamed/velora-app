import {
  CopilotRuntime,
  AnthropicAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const serviceAdapter = new AnthropicAdapter({
  model: process.env.COPILOT_MODEL || 'claude-sonnet-4-20250514',
})

const runtime = new CopilotRuntime({
  actions: [
    {
      name: 'findSimilarCrashes',
      description:
        'Find crashes similar to the current one based on severity, location, collision type',
      parameters: [
        {
          name: 'crashId',
          type: 'string',
          description: 'The ID of the crash to find similar crashes for',
          required: true,
        },
        {
          name: 'stateCode',
          type: 'string',
          description: '2-letter state code to search within',
          required: false,
        },
        {
          name: 'severity',
          type: 'string',
          description: 'Crash severity to filter by',
          required: false,
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Max results to return',
          required: false,
        },
      ],
      handler: async ({ crashId, stateCode, severity, limit }: { crashId: string; stateCode?: string; severity?: string; limit?: number }) => {
        try {
          // Fetch the crash to get its details for similarity search
          const crashRes = await fetch(`${API_URL}/api/crashes/${crashId}`)
          if (!crashRes.ok) return { error: 'Crash not found', crashes: [] }
          const { data: crash } = await crashRes.json()

          // Search for similar crashes using the crashes API
          const params = new URLSearchParams({ limit: String(limit || 10) })
          if (stateCode || crash.stateCode) params.set('state', stateCode || crash.stateCode)
          if (severity || crash.crashSeverity) params.set('severity', severity || crash.crashSeverity)

          const searchRes = await fetch(`${API_URL}/api/crashes?${params}`)
          if (!searchRes.ok) return { error: 'Search failed', crashes: [] }
          const results = await searchRes.json()

          return {
            message: `Found ${results.total} similar crashes in ${stateCode || crash.stateCode}`,
            crashes: results.data.filter((c: { id: string }) => c.id !== crashId),
            total: results.total,
          }
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Failed to search', crashes: [] }
        }
      },
    },
    {
      name: 'generateEqualizer',
      description:
        'Generate a Crash Equalizer briefing with comparable crashes, liability signals, settlement context',
      parameters: [
        {
          name: 'crashId',
          type: 'string',
          description: 'The crash ID to generate an Equalizer briefing for',
          required: true,
        },
      ],
      handler: async ({ crashId }: { crashId: string }) => {
        try {
          // First check for cached briefing
          const cachedRes = await fetch(`${API_URL}/api/equalizer/${crashId}`)
          if (cachedRes.ok) {
            const cached = await cachedRes.json()
            return { message: 'Equalizer briefing retrieved', briefing: cached.data }
          }

          // Generate fresh briefing
          const genRes = await fetch(`${API_URL}/api/equalizer/${crashId}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })

          if (!genRes.ok) {
            const err = await genRes.json().catch(() => ({ error: 'Generation failed' }))
            return { error: err.error || 'Failed to generate Equalizer briefing' }
          }

          const result = await genRes.json()
          return { message: 'Equalizer briefing generated', briefing: result.data }
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Failed to generate briefing' }
        }
      },
    },
  ],
})

export const POST = async (req: Request) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: '/api/copilot',
  })

  return handleRequest(req)
}

export const GET = async (req: Request) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: '/api/copilot',
  })

  return handleRequest(req)
}
