import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { registerTool } from './register'

export function registerEqualizerTools(server: McpServer) {
  registerTool(server,
    'generate_equalizer',
    'Generate a Crash Equalizer briefing for a specific crash — comparable crashes, liability signals, settlement context',
    {
      crashId: z.string().describe('The crash ID to generate an Equalizer for'),
    },
    async (params) => {
      const existing = await prisma.crashEqualizer.findUnique({
        where: { crashId: params.crashId },
      })

      if (existing) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'cached',
              crashId: params.crashId,
              confidenceLevel: existing.confidenceLevel,
              comparableCohort: existing.comparableCohort,
              liabilitySignals: existing.liabilitySignals,
              settlementContext: existing.settlementContext,
              briefingSections: existing.briefingSections,
              generatedAt: existing.generatedAt.toISOString(),
            }),
          }],
        }
      }

      const crash = await prisma.crash.findUnique({
        where: { id: params.crashId },
        select: { id: true, stateCode: true, crashSeverity: true },
      })

      if (!crash) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Crash not found' }) }] }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'not_generated',
            crashId: params.crashId,
            stateCode: crash.stateCode,
            severity: crash.crashSeverity,
            note: 'Equalizer briefing not yet generated. Call POST /api/equalizer/:crashId/generate to create one.',
          }),
        }],
      }
    }
  )

  registerTool(server,
    'get_equalizer',
    'Retrieve an existing Crash Equalizer briefing for a crash',
    {
      crashId: z.string().describe('The crash ID'),
    },
    async (params) => {
      const equalizer = await prisma.crashEqualizer.findUnique({
        where: { crashId: params.crashId },
      })

      if (!equalizer) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'No Equalizer briefing found', crashId: params.crashId }),
          }],
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            crashId: params.crashId,
            confidenceLevel: equalizer.confidenceLevel,
            comparableCohort: equalizer.comparableCohort,
            liabilitySignals: equalizer.liabilitySignals,
            settlementContext: equalizer.settlementContext,
            briefingSections: equalizer.briefingSections,
            modelVersion: equalizer.modelVersion,
            generationMs: equalizer.generationMs,
            generatedAt: equalizer.generatedAt.toISOString(),
          }),
        }],
      }
    }
  )
}
