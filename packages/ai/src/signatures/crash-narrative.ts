/**
 * DSPy-style typed signature for crash narrative generation.
 * Uses ax-llm/ax for structured input → output definitions.
 */

import { z } from 'zod'

/**
 * Crash narrative input schema — the data fields fed to the LLM.
 */
export const CrashNarrativeInputSchema = z.object({
  stateCode: z.string().describe('Two-letter state code (e.g., CO, PA)'),
  crashDate: z.string().describe('ISO date string of crash occurrence'),
  crashTime: z.string().optional().describe('Time of crash (HH:MM format)'),
  severity: z.string().describe('Crash severity: FATAL, SERIOUS_INJURY, MINOR_INJURY, PROPERTY_DAMAGE_ONLY'),
  county: z.string().optional().describe('County where crash occurred'),
  city: z.string().optional().describe('City where crash occurred'),
  location: z.string().optional().describe('Street address or intersection'),
  latitude: z.number().optional().describe('GPS latitude'),
  longitude: z.number().optional().describe('GPS longitude'),
  mannerOfCollision: z.string().optional().describe('Type of collision: REAR_END, HEAD_ON, ANGLE, etc.'),
  weatherCondition: z.string().optional().describe('Weather at time of crash'),
  lightCondition: z.string().optional().describe('Lighting conditions'),
  roadSurfaceCondition: z.string().optional().describe('Road surface condition'),
  vehicleCount: z.number().describe('Number of vehicles involved'),
  personCount: z.number().describe('Number of persons involved'),
  vehicles: z.array(z.object({
    year: z.string().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    bodyType: z.string().optional(),
    travelDirection: z.string().optional(),
    damageExtent: z.string().optional(),
  })).describe('Vehicle details'),
  injurySummary: z.string().optional().describe('Summary of injuries'),
  contributingFactors: z.array(z.string()).optional().describe('Contributing factors'),
})

export type CrashNarrativeInput = z.infer<typeof CrashNarrativeInputSchema>

/**
 * Crash narrative output schema — the structured narrative the LLM produces.
 */
export const CrashNarrativeOutputSchema = z.object({
  headline: z.string().describe('Factual, non-sensational headline (max 120 chars)'),
  summary: z.string().describe('2-3 sentence summary of the crash'),
  whatHappened: z.string().describe('Detailed narrative of the crash sequence'),
  whereItHappened: z.string().describe('Location context and road characteristics'),
  vehiclesInvolved: z.string().describe('Description of vehicles and their involvement'),
  injuriesAndSeverity: z.string().describe('Injury summary without PII'),
  contributingFactors: z.string().describe('Analysis of contributing factors'),
  roadAndWeatherConditions: z.string().describe('Environmental conditions'),
  whatThisMeansForYou: z.string().describe('Plain-language implications for crash victims'),
  nextSteps: z.string().describe('Actionable next steps for involved parties'),
})

export type CrashNarrativeOutput = z.infer<typeof CrashNarrativeOutputSchema>

/**
 * DSPy-style signature definition for crash narrative generation.
 */
export const crashNarrativeSignature = {
  name: 'CrashNarrative',
  description: 'Generate a trauma-informed, factual crash narrative from structured crash data. No PII, no sensationalism.',
  input: CrashNarrativeInputSchema,
  output: CrashNarrativeOutputSchema,
  instructions: [
    'Write in third person, factual tone',
    'Never include names, phone numbers, addresses, or other PII',
    'Use trauma-informed language — no sensationalist words like "horrific" or "devastating"',
    'Focus on facts: what happened, where, when, vehicles, conditions',
    'Include actionable "what this means" and "next steps" sections',
    'Headline must be factual and under 120 characters',
    'All sections must be present and non-empty',
  ],
} as const
