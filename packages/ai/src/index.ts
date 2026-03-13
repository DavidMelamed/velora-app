// Gateway
export { getModel, getModelForCrash, getModelTierForCrash, getActiveProvider, recordProviderFailure } from './gateway'
export type { ModelTier, ProviderName } from './gateway'

// Tools
export {
  searchCrashesTool,
  getIntersectionStatsTool,
  findAttorneysTool,
  getTrendsTool,
  searchCrashes,
  searchCrashesParameters,
  getIntersectionStats,
  getIntersectionStatsParameters,
  findAttorneys,
  findAttorneysParameters,
  getTrends,
  getTrendsParameters,
} from './tools/search-tools'

// Personas
export { detectPersona, getPersonaConfig } from './personas'
export type { PersonaType, DetectedPersona, PersonaConfig } from './personas'

// Prompts
export { getNarrativePrompt, NARRATIVE_SYSTEM_PROMPTS, NARRATIVE_GLOBAL_RULES } from './prompts/narrative-prompts'
export { classifyDataTier, getDataTierDescription } from './prompts/data-tier'
export type { DataTier } from './prompts/data-tier'
