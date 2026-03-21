/**
 * DSPy-style typed signature for persona detection/adaptation.
 */

import { z } from 'zod'

/**
 * Input for persona detection — the raw message from the user.
 */
export const PersonaAdapterInputSchema = z.object({
  messageText: z.string().describe('Raw text message from the user'),
  previousMessages: z.array(z.string()).optional().describe('Previous messages in the conversation for context'),
  pageContext: z.string().optional().describe('What page the user is currently viewing'),
})

export type PersonaAdapterInput = z.infer<typeof PersonaAdapterInputSchema>

/**
 * Output of persona detection — identified persona with confidence.
 */
export const PersonaAdapterOutputSchema = z.object({
  persona: z.enum([
    'CRASH_VICTIM',
    'FAMILY_MEMBER',
    'ATTORNEY',
    'INSURANCE_ADJUSTER',
    'JOURNALIST',
    'RESEARCHER',
    'GENERAL',
  ]).describe('Detected user persona'),
  confidence: z.number().min(0).max(1).describe('Confidence in persona detection (0-1)'),
  reasoning: z.string().describe('Brief explanation of why this persona was detected'),
  toneAdjustments: z.object({
    empathyLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('How much empathy to express'),
    technicalLevel: z.enum(['EXPERT', 'MODERATE', 'SIMPLE']).describe('Technical language level'),
    urgencyLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('How urgently to respond'),
    callToAction: z.string().describe('Appropriate CTA for this persona'),
  }).describe('Tone adjustments for the detected persona'),
})

export type PersonaAdapterOutput = z.infer<typeof PersonaAdapterOutputSchema>

/**
 * DSPy-style signature for persona detection.
 */
export const personaAdapterSignature = {
  name: 'PersonaAdapter',
  description: 'Detect the user persona from their message and context, then provide tone/language adjustments for the response.',
  input: PersonaAdapterInputSchema,
  output: PersonaAdapterOutputSchema,
  instructions: [
    'Default to CRASH_VICTIM if uncertain — err on the side of empathy',
    'Attorneys use legal terminology: "negligence", "liability", "damages"',
    'Family members express concern about a loved one, not themselves',
    'Insurance adjusters ask about fault, coverage, policy details',
    'Journalists ask about patterns, statistics, trends',
    'High empathy for victims and family, moderate for general, low for professionals',
    'CRASH_VICTIM should always get simple language and high urgency CTAs',
  ],
} as const
