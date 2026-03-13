import {
  CopilotRuntime,
  AnthropicAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime'

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
          name: 'radius',
          type: 'number',
          description: 'Search radius in miles',
          required: false,
        },
      ],
      handler: async ({ crashId, radius }: { crashId: string; radius?: number }) => {
        // TODO: Implement when search API is ready
        return {
          message: `Similar crash search for ${crashId} within ${radius || 10} miles. API integration pending.`,
          crashes: [],
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
        // TODO: Implement when Equalizer API is ready
        return {
          message: `Equalizer briefing generation for crash ${crashId}. API integration pending.`,
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
