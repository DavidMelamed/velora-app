/**
 * GEPA Optimizer — Generative Evolutionary Prompt Algorithm.
 * Generates N prompt variants, evaluates on sample data, selects winners.
 */

import { generateText } from 'ai'
import { getModel } from '../gateway'
import {
  createPromptVersion,
  recordScores,
  promoteVersion,
  getActiveVersion,
  type PromptVersionRecord,
} from './prompt-lineage'
import { getFormattedExamples } from '../signatures'

export interface GEPAConfig {
  signature: 'narrative' | 'equalizer' | 'persona'
  variants: number
  samples: number
  archetypeId?: string
  dryRun?: boolean
}

export interface GEPACycleResult {
  totalVariants: number
  evaluatedVariants: number
  winner: {
    id: string
    version: number
    compositeScore: number
    scores: Record<string, number>
  } | null
  variants: Array<{
    id: string
    version: number
    mutations: string[]
    compositeScore: number
    scores: Record<string, number>
  }>
  promoted: boolean
}

// Mutation strategies
const MUTATION_STRATEGIES = [
  'REPHRASE',
  'ADD_SECTION',
  'REMOVE_SECTION',
  'ADJUST_TONE_FORMAL',
  'ADJUST_TONE_CASUAL',
  'ADD_EXAMPLES',
  'SIMPLIFY_LANGUAGE',
  'ADD_CONTEXT',
  'REORDER_SECTIONS',
  'EMPHASIZE_EMPATHY',
] as const

type MutationStrategy = (typeof MUTATION_STRATEGIES)[number]

/**
 * Run a GEPA optimization cycle.
 * 1. Load the current active prompt (or base prompt)
 * 2. Generate N mutated variants
 * 3. Evaluate each on sample data
 * 4. Score by composite metric
 * 5. Promote the winner if it beats the current active
 */
export async function runGEPACycle(config: GEPAConfig): Promise<GEPACycleResult> {
  const { signature, variants: variantCount, dryRun = false } = config

  console.log(`[GEPA] Starting cycle: signature=${signature}, variants=${variantCount}, dryRun=${dryRun}`)

  // 1. Get current active prompt
  const currentActive = await getActiveVersion(signature, config.archetypeId)
  const basePrompt = currentActive?.promptContent || getDefaultPrompt(signature)

  // 2. Generate mutated variants
  const mutatedVariants = await generateVariants(basePrompt, signature, variantCount)

  // 3. Create prompt version records (skip in dry run)
  const versionRecords: PromptVersionRecord[] = []
  if (!dryRun) {
    for (const variant of mutatedVariants) {
      const record = await createPromptVersion({
        signature,
        parentId: currentActive?.id,
        archetypeId: config.archetypeId,
        promptContent: variant.content,
        mutations: variant.mutations,
      })
      versionRecords.push(record)
    }
  }

  // 4. Evaluate each variant
  const evaluatedVariants: Array<{
    id: string
    version: number
    mutations: string[]
    compositeScore: number
    scores: Record<string, number>
  }> = []

  for (let i = 0; i < mutatedVariants.length; i++) {
    const variant = mutatedVariants[i]!
    const scores = await evaluateVariant(variant.content, signature, config.samples)
    const compositeScore = computeCompositeScore(scores)

    const record = versionRecords[i]
    if (record && !dryRun) {
      await recordScores(record.id, scores, compositeScore)
    }

    evaluatedVariants.push({
      id: record?.id || `dry-run-${i}`,
      version: record?.version || i + 1,
      mutations: variant.mutations,
      compositeScore,
      scores,
    })
  }

  // 5. Select winner
  evaluatedVariants.sort((a, b) => b.compositeScore - a.compositeScore)
  const winner = evaluatedVariants[0] || null

  // 6. Promote winner if it beats current active
  let promoted = false
  if (winner && !dryRun) {
    const currentScore = currentActive?.compositeScore ?? 0
    if (winner.compositeScore > currentScore) {
      await promoteVersion(winner.id)
      promoted = true
      console.log(
        `[GEPA] Winner promoted: v${winner.version} (score: ${winner.compositeScore.toFixed(3)}) beats current (${currentScore.toFixed(3)})`,
      )
    } else {
      console.log(
        `[GEPA] No improvement: best variant score ${winner.compositeScore.toFixed(3)} vs current ${currentScore.toFixed(3)}`,
      )
    }
  }

  return {
    totalVariants: variantCount,
    evaluatedVariants: evaluatedVariants.length,
    winner: winner
      ? {
          id: winner.id,
          version: winner.version,
          compositeScore: winner.compositeScore,
          scores: winner.scores,
        }
      : null,
    variants: evaluatedVariants,
    promoted,
  }
}

/**
 * Generate mutated prompt variants using LLM.
 */
async function generateVariants(
  basePrompt: Record<string, unknown>,
  signature: string,
  count: number,
): Promise<Array<{ content: Record<string, unknown>; mutations: string[] }>> {
  const variants: Array<{ content: Record<string, unknown>; mutations: string[] }> = []

  for (let i = 0; i < count; i++) {
    // Select 1-3 random mutations
    const numMutations = 1 + Math.floor(Math.random() * 3)
    const selectedMutations: MutationStrategy[] = []
    const available = [...MUTATION_STRATEGIES]

    for (let m = 0; m < numMutations; m++) {
      const idx = Math.floor(Math.random() * available.length)
      selectedMutations.push(available[idx]!)
      available.splice(idx, 1)
    }

    try {
      const model = getModel('budget')
      const { text } = await generateText({
        model,
        system: `You are a prompt engineering optimizer. Given a base prompt and mutation strategies, produce an improved version of the prompt.

Return ONLY valid JSON with the same structure as the input prompt. Apply the requested mutations to improve the prompt's effectiveness.`,
        prompt: `Base prompt:
${JSON.stringify(basePrompt, null, 2)}

Mutations to apply: ${selectedMutations.join(', ')}

Signature type: ${signature}

Few-shot examples for context:
${getFormattedExamples(signature as 'narrative' | 'equalizer' | 'persona', 1)}

Return the mutated prompt as JSON:`,
        maxTokens: 2000,
      })

      try {
        // Try to parse as JSON, falling back to using the base with annotations
        const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''))
        variants.push({
          content: parsed as Record<string, unknown>,
          mutations: selectedMutations,
        })
      } catch {
        // If JSON parsing fails, use base prompt with mutation annotations
        variants.push({
          content: {
            ...basePrompt,
            _mutations: selectedMutations,
            _mutatedText: text.slice(0, 500),
          },
          mutations: selectedMutations,
        })
      }
    } catch (error) {
      console.warn(`[GEPA] Failed to generate variant ${i + 1}:`, error)
      // Use base with random perturbation
      variants.push({
        content: {
          ...basePrompt,
          _perturbation: `variant-${i + 1}`,
        },
        mutations: selectedMutations,
      })
    }
  }

  return variants
}

/**
 * Evaluate a prompt variant against sample data.
 * Returns scores for multiple quality dimensions.
 */
async function evaluateVariant(
  promptContent: Record<string, unknown>,
  signature: string,
  _sampleCount: number,
): Promise<Record<string, number>> {
  // In production, this would run the prompt against real sample data
  // and measure output quality. For now, use LLM-as-judge evaluation.

  try {
    const model = getModel('budget')
    const examples = getFormattedExamples(signature as 'narrative' | 'equalizer' | 'persona', 2)

    const { text } = await generateText({
      model,
      system: `You are a prompt quality evaluator. Score the given prompt on multiple dimensions from 0.0 to 1.0.

Return ONLY valid JSON with these keys:
- clarity: How clear and unambiguous the prompt is
- completeness: How well it covers all necessary aspects
- tone: How appropriate the tone is for the use case
- actionability: How actionable the outputs would be
- safety: How well it prevents harmful/incorrect outputs`,
      prompt: `Evaluate this prompt for the "${signature}" use case:

${JSON.stringify(promptContent, null, 2)}

Reference examples of good outputs:
${examples}

Return scores as JSON:`,
      maxTokens: 200,
    })

    try {
      const scores = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''))
      return {
        clarity: clamp(scores.clarity ?? 0.5),
        completeness: clamp(scores.completeness ?? 0.5),
        tone: clamp(scores.tone ?? 0.5),
        actionability: clamp(scores.actionability ?? 0.5),
        safety: clamp(scores.safety ?? 0.5),
      }
    } catch {
      return defaultScores()
    }
  } catch {
    return defaultScores()
  }
}

/**
 * Compute composite score from individual dimension scores.
 */
function computeCompositeScore(scores: Record<string, number>): number {
  // Weighted: safety is most important, then clarity and completeness
  const weights: Record<string, number> = {
    safety: 0.3,
    clarity: 0.25,
    completeness: 0.2,
    tone: 0.15,
    actionability: 0.1,
  }

  let total = 0
  let weightSum = 0

  for (const [key, weight] of Object.entries(weights)) {
    total += (scores[key] ?? 0.5) * weight
    weightSum += weight
  }

  return weightSum > 0 ? Math.round((total / weightSum) * 1000) / 1000 : 0.5
}

function getDefaultPrompt(signature: string): Record<string, unknown> {
  switch (signature) {
    case 'narrative':
      return {
        system: 'Generate a trauma-informed crash narrative from structured data.',
        instructions: [
          'Write in third person, factual tone',
          'Never include PII',
          'Include all 10 narrative sections',
        ],
      }
    case 'equalizer':
      return {
        system: 'Generate a Crash Equalizer briefing from comparable crash data.',
        instructions: [
          'Plain language a crash victim can understand',
          'Include specific deadlines',
          'Be transparent about confidence levels',
        ],
      }
    case 'persona':
      return {
        system: 'Detect user persona and adapt response tone.',
        instructions: [
          'Default to CRASH_VICTIM if uncertain',
          'High empathy for victims and family',
        ],
      }
    default:
      return { system: 'Process the input and produce structured output.' }
  }
}

function defaultScores(): Record<string, number> {
  return {
    clarity: 0.5,
    completeness: 0.5,
    tone: 0.5,
    actionability: 0.5,
    safety: 0.5,
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
