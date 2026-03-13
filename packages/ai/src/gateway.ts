import type { LanguageModelV1 } from 'ai'

export type ModelTier = 'premium' | 'standard' | 'budget'

export type ProviderName = 'anthropic' | 'openrouter' | 'google'

interface ProviderConfig {
  name: ProviderName
  envKey: string
  isAvailable: () => boolean
  getModel: (tier: ModelTier) => LanguageModelV1
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

function createAnthropicProvider(): ProviderConfig {
  return {
    name: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    isAvailable: () => !!process.env.ANTHROPIC_API_KEY && checkCircuitBreaker('anthropic'),
    getModel: (tier: ModelTier) => {
      // Dynamic import to avoid errors when key not set
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
          return openrouter('anthropic/claude-opus-4-6')
        case 'standard':
          return openrouter('anthropic/claude-sonnet-4-6')
        case 'budget':
          return openrouter('anthropic/claude-haiku-4-5-20251001')
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

// Provider chain: Anthropic -> OpenRouter -> Google
const providerChain: ProviderConfig[] = [
  createAnthropicProvider(),
  createOpenRouterProvider(),
  createGoogleProvider(),
]

/**
 * Get a model for the given tier with automatic failover.
 * Tries providers in order: Anthropic -> OpenRouter -> Google AI
 * Skips providers with missing API keys or open circuit breakers.
 */
export function getModel(tier: ModelTier): LanguageModelV1 {
  for (const provider of providerChain) {
    if (provider.isAvailable()) {
      return provider.getModel(tier)
    }
  }

  throw new Error(
    'No AI provider available. Set at least one of: ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY'
  )
}

/**
 * Get the appropriate model tier for a crash based on severity.
 * FATAL -> premium (Opus), SERIOUS_INJURY -> standard (Sonnet), other -> budget (Haiku)
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
