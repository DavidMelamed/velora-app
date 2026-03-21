/**
 * DSPy-style typed signature for Equalizer briefing generation.
 */

import { z } from 'zod'

/**
 * Input for Equalizer briefing — crash data plus cohort and signals.
 */
export const EqualizerBriefingInputSchema = z.object({
  // Crash data
  crashId: z.string().describe('Unique crash identifier'),
  stateCode: z.string().describe('Two-letter state code'),
  severity: z.string().describe('Crash severity level'),
  mannerOfCollision: z.string().optional().describe('Type of collision'),
  crashDate: z.string().describe('ISO date of crash'),

  // Cohort data
  cohortSize: z.number().describe('Number of comparable crashes found'),
  cohortConfidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('Confidence level of the cohort'),
  avgSeverity: z.string().optional().describe('Average severity in cohort'),

  // Liability signals
  liabilitySignals: z.array(z.object({
    type: z.string().describe('Signal type (e.g., REAR_END_PRESUMPTION)'),
    description: z.string().describe('Human-readable description'),
    strength: z.enum(['STRONG', 'MODERATE', 'WEAK']).describe('Signal strength'),
    favorsSide: z.enum(['PLAINTIFF', 'DEFENDANT', 'NEUTRAL']).describe('Who the signal favors'),
  })).describe('Liability signals extracted from crash data'),

  // Settlement context
  settlementRange: z.object({
    low: z.number().describe('Low end of settlement range in USD'),
    mid: z.number().describe('Midpoint of settlement range'),
    high: z.number().describe('High end of settlement range'),
  }).describe('Estimated settlement range'),

  // State legal context
  faultType: z.string().optional().describe('State fault system type'),
  statuteOfLimitations: z.number().optional().describe('Statute of limitations in years'),
})

export type EqualizerBriefingInput = z.infer<typeof EqualizerBriefingInputSchema>

/**
 * Output for Equalizer briefing — structured sections.
 */
export const EqualizerBriefingOutputSchema = z.object({
  situationSummary: z.string().describe('Plain-language summary of the crash situation and what the data shows'),
  liabilityAnalysis: z.string().describe('Analysis of liability signals and what they mean'),
  settlementContext: z.string().describe('What the settlement range means and how it was estimated'),
  timelinePressure: z.string().describe('Important deadlines and time-sensitive actions'),
  actionItems: z.array(z.string()).describe('Ordered list of recommended next steps'),
  confidenceNote: z.string().describe('Transparency note about data confidence and limitations'),
})

export type EqualizerBriefingOutput = z.infer<typeof EqualizerBriefingOutputSchema>

/**
 * DSPy-style signature for Equalizer briefing generation.
 */
export const equalizerBriefingSignature = {
  name: 'EqualizerBriefing',
  description: 'Generate a personalized Crash Equalizer briefing that helps crash victims understand their situation, comparable cases, liability signals, and settlement context.',
  input: EqualizerBriefingInputSchema,
  output: EqualizerBriefingOutputSchema,
  instructions: [
    'Write in empathetic, plain language a crash victim can understand',
    'Never provide legal advice — frame as informational context',
    'Be transparent about confidence levels and data limitations',
    'Include specific deadlines (statute of limitations) prominently',
    'Settlement ranges are estimates, not guarantees — make this clear',
    'Action items should be concrete and ordered by urgency',
    'Avoid insurance industry jargon',
  ],
} as const
