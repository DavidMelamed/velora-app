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

// Signatures (DSPy-style)
export {
  crashNarrativeSignature,
  CrashNarrativeInputSchema,
  CrashNarrativeOutputSchema,
  equalizerBriefingSignature,
  EqualizerBriefingInputSchema,
  EqualizerBriefingOutputSchema,
  personaAdapterSignature,
  PersonaAdapterInputSchema,
  PersonaAdapterOutputSchema,
  narrativeExamples,
  equalizerExamples,
  personaExamples,
  getFormattedExamples,
} from './signatures'
export type {
  CrashNarrativeInput,
  CrashNarrativeOutput,
  EqualizerBriefingInput,
  EqualizerBriefingOutput,
  PersonaAdapterInput,
  PersonaAdapterOutput,
} from './signatures'

// Optimization (GEPA)
export { runGEPACycle } from './optimization/gepa-optimizer'
export type { GEPAConfig, GEPACycleResult } from './optimization/gepa-optimizer'
export {
  createPromptVersion,
  recordScores,
  promoteVersion,
  getActiveVersion,
  getLineage,
  getVersionHistory,
  rollbackToVersion,
} from './optimization/prompt-lineage'
export type { PromptVersionRecord } from './optimization/prompt-lineage'

// Budget Tracker
export { budgetTracker, BudgetTracker } from './routing/budget-tracker'
export type { ModelUsageEntry, DailyBudgetConfig, BudgetStatus } from './routing/budget-tracker'
