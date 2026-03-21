/**
 * AI Budget Tracker — Track model usage and enforce daily spending limits.
 *
 * Features:
 *   - Per-model token tracking
 *   - Daily budget enforcement with configurable limits
 *   - Cost estimation based on known model pricing
 *   - Usage logging for analytics
 *   - Graceful fallback: if budget exceeded, suggest cheaper model
 */

export interface ModelUsageEntry {
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  timestamp: Date
  requestId?: string
  operation?: string
}

export interface DailyBudgetConfig {
  /** Max daily spend in USD (default $10) */
  dailyLimitUsd: number
  /** Warn at this percentage of daily limit (default 0.8 = 80%) */
  warnThreshold: number
  /** Hard stop at this percentage (default 1.0 = 100%) */
  hardStopThreshold: number
  /** Whether to enforce limits or just warn */
  enforceLimit: boolean
}

export interface BudgetStatus {
  dailySpend: number
  dailyLimit: number
  remainingBudget: number
  usagePercentage: number
  isOverBudget: boolean
  isNearLimit: boolean
  requestCount: number
  topModels: Array<{ model: string; cost: number; requests: number }>
}

/** Approximate cost per 1K tokens for common models (USD) */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-6': { input: 0.015, output: 0.075 },
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5-20251001': { input: 0.0008, output: 0.004 },
  // OpenRouter (same Anthropic models, slightly higher)
  'anthropic/claude-opus-4-6': { input: 0.016, output: 0.08 },
  'anthropic/claude-sonnet-4-6': { input: 0.0032, output: 0.016 },
  'anthropic/claude-haiku-4-5-20251001': { input: 0.0009, output: 0.0045 },
  // Google
  'gemini-2.5-pro': { input: 0.007, output: 0.021 },
  'gemini-2.5-flash': { input: 0.0015, output: 0.005 },
  'gemini-2.0-flash-lite': { input: 0.0001, output: 0.0004 },
}

const DEFAULT_PRICING = { input: 0.003, output: 0.015 } // Standard tier fallback

const DEFAULT_BUDGET_CONFIG: DailyBudgetConfig = {
  dailyLimitUsd: parseFloat(process.env.AI_DAILY_BUDGET_USD || '10'),
  warnThreshold: 0.8,
  hardStopThreshold: 1.0,
  enforceLimit: process.env.AI_ENFORCE_BUDGET !== 'false',
}

/**
 * In-memory budget tracker. Resets daily.
 * In production, this should be backed by Redis for multi-instance support.
 */
class BudgetTracker {
  private entries: ModelUsageEntry[] = []
  private currentDay: string = ''
  private config: DailyBudgetConfig

  constructor(config?: Partial<DailyBudgetConfig>) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config }
    this.currentDay = this.getDayKey()
  }

  private getDayKey(): string {
    return new Date().toISOString().split('T')[0]
  }

  private resetIfNewDay(): void {
    const today = this.getDayKey()
    if (today !== this.currentDay) {
      console.log(`[BudgetTracker] New day detected (${today}). Resetting daily counters.`)
      this.entries = []
      this.currentDay = today
    }
  }

  /**
   * Estimate cost for a model request.
   */
  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING
    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output
  }

  /**
   * Record a model usage event.
   */
  recordUsage(entry: Omit<ModelUsageEntry, 'estimatedCost' | 'timestamp'>): ModelUsageEntry {
    this.resetIfNewDay()

    const estimatedCost = this.estimateCost(entry.model, entry.inputTokens, entry.outputTokens)

    const fullEntry: ModelUsageEntry = {
      ...entry,
      estimatedCost,
      timestamp: new Date(),
    }

    this.entries.push(fullEntry)

    // Structured JSON log for Railway
    console.log(JSON.stringify({
      level: 'info',
      service: 'velora-ai',
      event: 'model_usage',
      model: entry.model,
      provider: entry.provider,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      estimatedCost: estimatedCost.toFixed(6),
      operation: entry.operation,
      requestId: entry.requestId,
      dailySpend: this.getDailySpend().toFixed(4),
      timestamp: fullEntry.timestamp.toISOString(),
    }))

    return fullEntry
  }

  /**
   * Get total daily spend so far.
   */
  getDailySpend(): number {
    this.resetIfNewDay()
    return this.entries.reduce((sum, e) => sum + e.estimatedCost, 0)
  }

  /**
   * Check if the budget allows a request with the given model.
   * Returns true if the request is allowed.
   */
  canAfford(model: string, estimatedInputTokens: number = 1000, estimatedOutputTokens: number = 500): boolean {
    this.resetIfNewDay()

    if (!this.config.enforceLimit) return true

    const estimatedCost = this.estimateCost(model, estimatedInputTokens, estimatedOutputTokens)
    const projectedSpend = this.getDailySpend() + estimatedCost

    return projectedSpend <= this.config.dailyLimitUsd * this.config.hardStopThreshold
  }

  /**
   * Get current budget status.
   */
  getStatus(): BudgetStatus {
    this.resetIfNewDay()

    const dailySpend = this.getDailySpend()
    const usagePercentage = dailySpend / this.config.dailyLimitUsd

    // Aggregate by model
    const modelMap = new Map<string, { cost: number; requests: number }>()
    for (const entry of this.entries) {
      const existing = modelMap.get(entry.model) ?? { cost: 0, requests: 0 }
      existing.cost += entry.estimatedCost
      existing.requests += 1
      modelMap.set(entry.model, existing)
    }

    const topModels = Array.from(modelMap.entries())
      .map(([model, stats]) => ({ model, ...stats }))
      .sort((a, b) => b.cost - a.cost)

    return {
      dailySpend,
      dailyLimit: this.config.dailyLimitUsd,
      remainingBudget: Math.max(0, this.config.dailyLimitUsd - dailySpend),
      usagePercentage,
      isOverBudget: usagePercentage >= this.config.hardStopThreshold,
      isNearLimit: usagePercentage >= this.config.warnThreshold,
      requestCount: this.entries.length,
      topModels,
    }
  }

  /**
   * Suggest a cheaper model if budget is near limit.
   * Returns the suggested model name or null if current model is fine.
   */
  suggestCheaperModel(currentModel: string): string | null {
    const status = this.getStatus()

    if (!status.isNearLimit) return null

    // Model downgrade chain
    const downgrades: Record<string, string> = {
      'claude-opus-4-6': 'claude-sonnet-4-6',
      'anthropic/claude-opus-4-6': 'anthropic/claude-sonnet-4-6',
      'claude-sonnet-4-6': 'claude-haiku-4-5-20251001',
      'anthropic/claude-sonnet-4-6': 'anthropic/claude-haiku-4-5-20251001',
      'gemini-2.5-pro': 'gemini-2.5-flash',
      'gemini-2.5-flash': 'gemini-2.0-flash-lite',
    }

    return downgrades[currentModel] ?? null
  }

  /**
   * Update the budget configuration.
   */
  updateConfig(config: Partial<DailyBudgetConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get all usage entries for today (for analytics).
   */
  getTodayEntries(): ModelUsageEntry[] {
    this.resetIfNewDay()
    return [...this.entries]
  }
}

// Singleton instance
export const budgetTracker = new BudgetTracker()

// Re-export types and class for testing
export { BudgetTracker }
