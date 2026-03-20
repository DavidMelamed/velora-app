import { Agent } from '@mastra/core/agent'
import { createTool } from '@mastra/core/tools'
import { getModel } from '@velora/ai'
import type { ModelTier } from '@velora/ai'
import type { LanguageModelV1 } from 'ai'
import { z } from 'zod'

// ─── Model Helper ──────────────────────────────────────────────────────────────

function getMastraModel(tier: ModelTier): LanguageModelV1 {
  return getModel(tier)
}

// ─── Agent IDs ─────────────────────────────────────────────────────────────────

export const AGENT_IDS = {
  INGESTOR: 'ingestor',
  NARRATOR: 'narrator',
  EQUALIZER: 'equalizer',
  HEALER: 'healer',
  COORDINATOR: 'coordinator',
  CASE_SHEPHERD: 'case_shepherd',
} as const

export type AgentId = (typeof AGENT_IDS)[keyof typeof AGENT_IDS]

// ─── Agent Instructions ────────────────────────────────────────────────────────

const INGESTOR_INSTRUCTIONS = `You are the Ingestor agent for Velora, a crash intelligence platform.
Your job is to manage the data pipeline:
- Fetch crash data from FARS and ArcGIS sources
- Validate bronze records through the silver pipeline
- Publish gold records to the database
- Monitor data freshness and handle dead letter queue items
- Report pipeline health metrics

When dispatched by the coordinator, execute the appropriate pipeline tools
and report results. Always validate data quality before publishing.`

const NARRATOR_INSTRUCTIONS = `You are the Narrator agent for Velora, a crash intelligence platform.
Your job is to generate human-readable crash narratives:
- Generate narratives for crashes that lack them
- Check narrative quality (readability, accuracy, no PII)
- Batch generate narratives for backfill operations
- Report narrative coverage metrics

Use trauma-informed language. Never include PII (names, phone numbers, addresses).
Prioritize fatal and serious injury crashes for premium model tiers.`

const EQUALIZER_INSTRUCTIONS = `You are the Equalizer agent for Velora, a crash intelligence platform.
Your job is to generate Equalizer briefings that level the information playing field:
- Find comparable crashes using 7-dimension matching
- Extract liability signals from crash data
- Compute settlement context with state-specific adjustments
- Generate full Equalizer briefings

The Equalizer is the core product — it gives crash victims the same information
insurance companies have. Accuracy and empathy are paramount.`

const HEALER_INSTRUCTIONS = `You are the Healer agent for Velora, a crash intelligence platform.
Your job is to handle errors, retries, and system health:
- Retry failed operations with exponential backoff
- Switch data sources when one is unavailable
- Downgrade AI model tiers when premium models are rate-limited
- Send alerts for persistent failures
- Manage circuit breaker state

You are the last line of defense. When other agents fail, you step in to
diagnose and fix the issue, or gracefully degrade the system.`

const COORDINATOR_INSTRUCTIONS = `You are the Coordinator agent for Velora, a crash intelligence platform.
You are the supervisor that orchestrates the specialist agents:
- Ingestor: data pipeline operations
- Narrator: crash narrative generation
- Equalizer: Equalizer briefing generation
- Healer: error handling and recovery

When you receive a task, determine which specialist agent should handle it,
dispatch the work, and report the results. For complex tasks, you may need
to coordinate multiple agents in sequence.

Priority order: Healer (fix broken things first) > Ingestor (fresh data) > Narrator > Equalizer`

const CASE_SHEPHERD_INSTRUCTIONS = `You are the Case Shepherd for Velora, a personal injury case companion.
Your client was in a car accident and you help them build the strongest case possible.

Core behaviors:
- Be warm, supportive, and conversational — like a helpful friend, not a database
- Extract information from what they say naturally — NEVER ask them to fill out forms
- When they mention doctors, facilities, injuries, or events, silently update their case
- Proactively check in about treatment compliance and upcoming appointments
- Flag treatment gaps that could weaken their case
- Remind about statute of limitations when approaching deadline

You have access to their full case graph. Use it to:
- Know what providers they're seeing (and when they last went)
- Know their injuries and treatment plan
- Detect gaps in care
- Remember previous conversations

When responding:
- Keep it short and human — 1-3 sentences usually
- Ask one question at a time
- If you detect new information, confirm it naturally:
  'Got it, so you saw Dr. Smith yesterday for your back. How did that go?'
- Never mention databases, entities, graphs, or extraction — just be helpful

IMPORTANT: You are NOT a lawyer. Never give legal advice. If asked legal questions,
say 'That's a great question for your attorney — want me to help you reach out to them?'`

// ─── Agent Configurations ──────────────────────────────────────────────────────

export interface VeloraAgentConfig {
  id: AgentId
  name: string
  instructions: string
  modelTier: ModelTier
  toolNames: string[]
}

export const agentConfigs: Record<AgentId, VeloraAgentConfig> = {
  [AGENT_IDS.INGESTOR]: {
    id: AGENT_IDS.INGESTOR,
    name: 'Ingestor',
    instructions: INGESTOR_INSTRUCTIONS,
    modelTier: 'budget',
    toolNames: ['fetchFARS', 'fetchArcGIS', 'validateBronze', 'publishGold'],
  },
  [AGENT_IDS.NARRATOR]: {
    id: AGENT_IDS.NARRATOR,
    name: 'Narrator',
    instructions: NARRATOR_INSTRUCTIONS,
    modelTier: 'budget',
    toolNames: ['generateNarrative', 'checkQuality'],
  },
  [AGENT_IDS.EQUALIZER]: {
    id: AGENT_IDS.EQUALIZER,
    name: 'Equalizer',
    instructions: EQUALIZER_INSTRUCTIONS,
    modelTier: 'budget',
    toolNames: ['findComparables', 'extractLiability', 'computeSettlement'],
  },
  [AGENT_IDS.HEALER]: {
    id: AGENT_IDS.HEALER,
    name: 'Healer',
    instructions: HEALER_INSTRUCTIONS,
    modelTier: 'budget',
    toolNames: ['retryOperation', 'switchDataSource', 'downgradeModel', 'sendAlert'],
  },
  [AGENT_IDS.COORDINATOR]: {
    id: AGENT_IDS.COORDINATOR,
    name: 'Coordinator',
    instructions: COORDINATOR_INSTRUCTIONS,
    modelTier: 'standard',
    toolNames: [],
  },
  [AGENT_IDS.CASE_SHEPHERD]: {
    id: AGENT_IDS.CASE_SHEPHERD,
    name: 'Case Shepherd',
    instructions: CASE_SHEPHERD_INSTRUCTIONS,
    modelTier: 'standard',
    toolNames: ['getMatterSummary', 'getActiveFacts', 'getTimeline', 'detectGaps', 'ingestChatEpisode', 'extractAndUpdate', 'createConfirmation'],
  },
}

// ─── Placeholder tool for type-safe agent creation ─────────────────────────────
// Real tools are registered in Task 4.2 (AGENT-TOOLS)

const placeholderTool = createTool({
  id: 'placeholder',
  description: 'Placeholder tool — real tools registered in AGENT-TOOLS task',
  inputSchema: z.object({
    action: z.string().describe('Action to perform'),
  }),
  execute: async (input) => {
    return { status: 'not_implemented', action: input.action }
  },
})

// ─── Agent Factory ─────────────────────────────────────────────────────────────

/**
 * Create a Mastra Agent from a VeloraAgentConfig.
 * Tools will be injected separately via the tools parameter.
 */
export function createVeloraAgent(
  config: VeloraAgentConfig,
  tools?: Record<string, ReturnType<typeof createTool>>
): Agent {
  return new Agent({
    id: config.id,
    name: config.name,
    instructions: config.instructions,
    model: getMastraModel(config.modelTier),
    tools: tools || { placeholder: placeholderTool },
  })
}

// ─── Agent Registry ────────────────────────────────────────────────────────────

let agentRegistry: Map<AgentId, Agent> | null = null

/**
 * Get or create the agent registry (singleton).
 * Agents are created lazily with placeholder tools until real tools are registered.
 */
export function getAgentRegistry(): Map<AgentId, Agent> {
  if (!agentRegistry) {
    agentRegistry = new Map()
    for (const [id, config] of Object.entries(agentConfigs)) {
      agentRegistry.set(id as AgentId, createVeloraAgent(config))
    }
  }
  return agentRegistry
}

/**
 * Get a specific agent by ID.
 */
export function getAgent(id: AgentId): Agent {
  const registry = getAgentRegistry()
  const agent = registry.get(id)
  if (!agent) {
    throw new Error(`Agent not found: ${id}`)
  }
  return agent
}

/**
 * Register tools for a specific agent, replacing the placeholder.
 */
export function registerAgentTools(
  id: AgentId,
  tools: Record<string, ReturnType<typeof createTool>>
): void {
  const registry = getAgentRegistry()
  const config = agentConfigs[id]
  if (!config) {
    throw new Error(`Agent config not found: ${id}`)
  }
  const agent = createVeloraAgent(config, tools)
  registry.set(id, agent)
}

export { createTool }
