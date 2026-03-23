import type { LanguageModelV1 } from 'ai'

export type ModelTier = 'premium' | 'standard' | 'budget'

export type ProviderName = 'anthropic' | 'openrouter' | 'google'

interface ProviderConfig {
  name: ProviderName
  envKey: string
  isAvailable: () => boolean
  getModel: (tier: ModelTier) => LanguageModelV1
}

const OPENROUTER_MODEL_IDS: Record<ModelTier, string> = {
  premium: process.env.AI_OPENROUTER_PREMIUM_MODEL || 'google/gemini-2.5-pro',
  standard: process.env.AI_OPENROUTER_STANDARD_MODEL || 'google/gemini-2.5-flash',
  budget: process.env.AI_OPENROUTER_BUDGET_MODEL || 'mistralai/ministral-8b',
}

// Circuit breaker state per provider
const circuitBreaker: Record<ProviderName, { failures: number; lastFailure: number; isOpen: boolean }> = {
  anthropic: { failures: 0, lastFailure: 0, isOpen: false },
  openrouter: { failures: 0, lastFailure: 0, isOpen: false },
  google: { failures: 0, lastFailure: 0, isOpen: false },
}

const CIRCUIT_BREAKER_THRESHOLD = 3
const CIRCUIT_BREAKER_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const CIRCUIT_BREAKER_RESET_MS = 10 * 60 * 1000 // 10 minutes

function checkCircuitBreaker(provider: ProviderName): boolean {
  const state = circuitBreaker[provider]
  if (!state.isOpen) return true

  // Check if reset period has elapsed
  if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
    state.isOpen = false
    state.failures = 0
    return true
  }

  return false
}

export function recordProviderFailure(provider: ProviderName): void {
  const state = circuitBreaker[provider]
  const now = Date.now()

  // Reset counter if outside the window
  if (now - state.lastFailure > CIRCUIT_BREAKER_WINDOW_MS) {
    state.failures = 0
  }

  state.failures++
  state.lastFailure = now

  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true
  }
}

// ============================================================
// COST-OPTIMIZED MODEL ROUTING
// ============================================================
// Previous config routed everything through expensive Anthropic models.
// Now uses cheap, high-quality models via OpenRouter as PRIMARY provider.
//
// Cost comparison (per 1M tokens input/output):
//   OLD: Claude Sonnet $3/$15, Haiku $0.80/$4
//   NEW: Gemini Flash $0.10/$0.40, Ministral 8B $0.15/$0.15
//
// Anthropic is ONLY used when explicitly requested via AI_PRIMARY_PROVIDER=anthropic
// ============================================================

function createOpenRouterProvider(): ProviderConfig {
  return {
    name: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    isAvailable: () => !!process.env.OPENROUTER_API_KEY && checkCircuitBreaker('openrouter'),
    getModel: (tier: ModelTier) => {
      const { createOpenAI } = require('@ai-sdk/openai') as typeof import('@ai-sdk/openai')
      const openrouter = createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      })
      switch (tier) {
        case 'premium':
          // Google Gemini Pro — high quality, much cheaper than Opus
          // $2/M input, $12/M output (vs Opus $15/$75)
          return openrouter(OPENROUTER_MODEL_IDS.premium)
        case 'standard':
          // Google Gemini Flash — fast, high quality, extremely cheap
          // $0.10/M input, $0.40/M output (vs Sonnet $3/$15)
          return openrouter(OPENROUTER_MODEL_IDS.standard)
        case 'budget':
          // Mistral Ministral 8B — fast classification/scoring
          // $0.15/M input, $0.15/M output (vs Haiku $0.80/$4)
          return openrouter(OPENROUTER_MODEL_IDS.budget)
      }
    },
  }
}

function createGoogleProvider(): ProviderConfig {
  return {
    name: 'google',
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    isAvailable: () => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY && checkCircuitBreaker('google'),
    getModel: (tier: ModelTier) => {
      const { createGoogleGenerativeAI } = require('@ai-sdk/google') as typeof import('@ai-sdk/google')
      const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
      switch (tier) {
        case 'premium':
          return google('gemini-2.5-pro')
        case 'standard':
          return google('gemini-2.5-flash')
        case 'budget':
          return google('gemini-2.0-flash-lite')
      }
    },
  }
}

function createAnthropicProvider(): ProviderConfig {
  return {
    name: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    isAvailable: () => !!process.env.ANTHROPIC_API_KEY && checkCircuitBreaker('anthropic'),
    getModel: (tier: ModelTier) => {
      const { createAnthropic } = require('@ai-sdk/anthropic') as typeof import('@ai-sdk/anthropic')
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      switch (tier) {
        case 'premium':
          return anthropic('claude-opus-4-6')
        case 'standard':
          return anthropic('claude-sonnet-4-6')
        case 'budget':
          return anthropic('claude-haiku-4-5-20251001')
      }
    },
  }
}

/**
 * Build provider chain based on AI_PRIMARY_PROVIDER env var.
 * Default: OpenRouter (cheap) → Google → Anthropic (expensive, last resort)
 * Set AI_PRIMARY_PROVIDER=anthropic to use Anthropic first (expensive!)
 */
function buildProviderChain(): ProviderConfig[] {
  const primary = process.env.AI_PRIMARY_PROVIDER

  if (primary === 'anthropic') {
    return [createAnthropicProvider(), createOpenRouterProvider(), createGoogleProvider()]
  }
  if (primary === 'google') {
    return [createGoogleProvider(), createOpenRouterProvider(), createAnthropicProvider()]
  }
  // Default: OpenRouter first (cheapest), Anthropic LAST
  return [createOpenRouterProvider(), createGoogleProvider(), createAnthropicProvider()]
}

const providerChain: ProviderConfig[] = buildProviderChain()

/**
 * Get a model for the given tier with automatic failover.
 * Default order: OpenRouter (cheap) → Google → Anthropic (expensive)
 * Override with AI_PRIMARY_PROVIDER env var.
 */
export function getModel(tier: ModelTier): LanguageModelV1 {
  for (const provider of providerChain) {
    if (provider.isAvailable()) {
      return provider.getModel(tier)
    }
  }

  throw new Error(
    'No AI provider available. Set at least one of: OPENROUTER_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY'
  )
}

/**
 * Get the appropriate model tier for a crash based on severity.
 * FATAL -> premium, SERIOUS_INJURY -> standard, other -> budget
 */
export function getModelTierForCrash(severity: string): ModelTier {
  switch (severity) {
    case 'FATAL':
      return 'premium'
    case 'SUSPECTED_SERIOUS_INJURY':
      return 'standard'
    default:
      return 'budget'
  }
}

/**
 * Get a model specifically routed for crash severity.
 */
export function getModelForCrash(severity: string): LanguageModelV1 {
  return getModel(getModelTierForCrash(severity))
}

/**
 * Get the first available provider name (for logging/tracking).
 */
export function getActiveProvider(): ProviderName | null {
  for (const provider of providerChain) {
    if (provider.isAvailable()) {
      return provider.name
    }
  }
  return null
}
