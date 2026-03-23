import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime'
import { SERVER_API_URL } from '@/lib/server-api-url'

// Use OpenRouter with cheap Gemini Flash instead of expensive Anthropic Sonnet
// Cost: ~$0.10/M input vs $3/M input (30x cheaper)
if (process.env.OPENROUTER_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.OPENROUTER_API_KEY
  process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1'
}

const serviceAdapter = new OpenAIAdapter({
  model: process.env.COPILOT_MODEL || 'google/gemini-2.5-flash-preview',
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
          const crashRes = await fetch(`${SERVER_API_URL}/api/crashes/${crashId}`)
          if (!crashRes.ok) return { error: 'Crash not found', crashes: [] }
          const { data: crash } = await crashRes.json()

          // Search for similar crashes using the crashes API
          const params = new URLSearchParams({ limit: String(limit || 10) })
          if (stateCode || crash.stateCode) params.set('state', stateCode || crash.stateCode)
          if (severity || crash.crashSeverity) params.set('severity', severity || crash.crashSeverity)

          const searchRes = await fetch(`${SERVER_API_URL}/api/crashes?${params}`)
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
          const cachedRes = await fetch(`${SERVER_API_URL}/api/equalizer/${crashId}`)
          if (cachedRes.ok) {
            const cached = await cachedRes.json()
            return { message: 'Equalizer briefing retrieved', briefing: cached.data }
          }

          // Generate fresh briefing
          const genRes = await fetch(`${SERVER_API_URL}/api/equalizer/${crashId}/generate`, {
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
    {
      name: 'searchAttorneyReviews',
      description:
        'Semantic search over attorney reviews. Find reviews mentioning specific qualities like communication, outcomes, fees, trial experience. Returns attorneys ranked by composite score with matched review snippets.',
      parameters: [
        { name: 'query', type: 'string', description: 'What to search for (e.g., "good communication", "won my case")', required: true },
        { name: 'stateCode', type: 'string', description: '2-letter state code', required: false },
        { name: 'city', type: 'string', description: 'City name', required: false },
        { name: 'limit', type: 'number', description: 'Max results', required: false },
      ],
      handler: async ({ query, stateCode, city, limit }: { query: string; stateCode?: string; city?: string; limit?: number }) => {
        try {
          const res = await fetch(`${SERVER_API_URL}/api/vector-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, stateCode, city, limit: limit || 5 }),
          })
          if (!res.ok) return { error: 'Search failed', attorneys: [] }
          return await res.json()
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Failed to search reviews', attorneys: [] }
        }
      },
    },
    {
      name: 'findNearbyAttorneys',
      description:
        'Find attorneys near a geographic location. Useful after viewing a crash to find nearby lawyers.',
      parameters: [
        { name: 'latitude', type: 'number', description: 'Center latitude', required: true },
        { name: 'longitude', type: 'number', description: 'Center longitude', required: true },
        { name: 'radiusMiles', type: 'number', description: 'Search radius in miles', required: false },
      ],
      handler: async ({ latitude, longitude, radiusMiles }: { latitude: number; longitude: number; radiusMiles?: number }) => {
        try {
          const params = new URLSearchParams({
            lat: String(latitude),
            lng: String(longitude),
            radius: String(radiusMiles || 25),
          })
          const res = await fetch(`${SERVER_API_URL}/api/attorneys/nearby?${params}`)
          if (!res.ok) return { error: 'Search failed', attorneys: [] }
          return await res.json()
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Failed to find nearby attorneys', attorneys: [] }
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
