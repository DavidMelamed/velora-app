import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { recordProviderFailure, getActiveProvider } from '@velora/ai'

/**
 * Healing tools — error recovery, retry, and system health management.
 */

export const retryOperation = createTool({
  id: 'retryOperation',
  description: 'Retry a failed pipeline run or agent session with exponential backoff tracking.',
  inputSchema: z.object({
    operationType: z.enum(['pipeline_run', 'narrative', 'equalizer']).describe('Type of operation to retry'),
    operationId: z.string().describe('ID of the failed operation (pipeline run ID, crash ID, etc.)'),
    maxRetries: z.number().int().min(1).max(5).default(3).describe('Maximum retry attempts'),
  }),
  execute: async (input) => {
    // Check previous attempts
    const previousAttempts = await prisma.agentSession.count({
      where: {
        agentId: 'healer',
        action: `retry_${input.operationType}`,
        input: {
          path: ['operationId'],
          equals: input.operationId,
        },
      },
    })

    if (previousAttempts >= input.maxRetries) {
      return {
        status: 'max_retries_exceeded',
        operationType: input.operationType,
        operationId: input.operationId,
        attempts: previousAttempts,
        maxRetries: input.maxRetries,
        recommendation: 'Manual intervention required. Check logs and dead letter queue.',
      }
    }

    // Log the retry attempt
    await prisma.agentSession.create({
      data: {
        agentId: 'healer',
        action: `retry_${input.operationType}`,
        input: { operationType: input.operationType, operationId: input.operationId },
        status: 'IN_PROGRESS',
      },
    })

    return {
      status: 'retry_scheduled',
      operationType: input.operationType,
      operationId: input.operationId,
      attemptNumber: previousAttempts + 1,
      maxRetries: input.maxRetries,
      backoffMs: Math.pow(2, previousAttempts) * 1000,
      note: 'Retry has been logged. The actual retry should be dispatched by the heartbeat loop.',
    }
  },
})

export const switchDataSource = createTool({
  id: 'switchDataSource',
  description: 'Check data source health and suggest alternatives when primary source is unavailable.',
  inputSchema: z.object({
    stateCode: z.string().length(2).describe('State code to check data sources for'),
    failedSource: z.enum(['fars', 'arcgis']).describe('The source that failed'),
  }),
  execute: async (input) => {
    const alternativeSources: Record<string, string[]> = {
      fars: ['arcgis'],
      arcgis: ['fars'],
    }

    const arcgisStates = ['PA', 'CO', 'IL', 'MA', 'WA']
    const alternatives = alternativeSources[input.failedSource] || []

    const availableAlternatives = alternatives.filter((alt) => {
      if (alt === 'arcgis') return arcgisStates.includes(input.stateCode.toUpperCase())
      return true // FARS covers all states
    })

    // Check recent failures for the failed source
    const recentFailures = await prisma.pipelineRun.count({
      where: {
        dataSource: { type: input.failedSource.toUpperCase() },
        status: 'FAILED',
        startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })

    return {
      stateCode: input.stateCode,
      failedSource: input.failedSource,
      recentFailureCount: recentFailures,
      availableAlternatives,
      recommendation:
        availableAlternatives.length > 0
          ? `Switch to ${availableAlternatives[0]} for ${input.stateCode}`
          : `No alternative sources available for ${input.stateCode}. Wait and retry.`,
    }
  },
})

export const downgradeModel = createTool({
  id: 'downgradeModel',
  description: 'Downgrade AI model tier when premium/standard models are rate-limited or unavailable.',
  inputSchema: z.object({
    currentTier: z.enum(['premium', 'standard', 'budget']).describe('Current model tier'),
    reason: z.string().describe('Reason for downgrade (e.g., "rate_limited", "timeout", "error")'),
  }),
  execute: async (input) => {
    const downgradeMap: Record<string, string> = {
      premium: 'standard',
      standard: 'budget',
      budget: 'budget', // Can't downgrade further
    }

    const newTier = downgradeMap[input.currentTier]
    const activeProvider = getActiveProvider()

    if (input.currentTier === 'budget') {
      return {
        status: 'already_minimum',
        currentTier: input.currentTier,
        activeProvider,
        recommendation: 'Already at budget tier. If still failing, check provider availability.',
      }
    }

    // Record provider failure if it was a provider issue
    if (input.reason === 'rate_limited' && activeProvider) {
      recordProviderFailure(activeProvider)
    }

    return {
      status: 'downgraded',
      previousTier: input.currentTier,
      newTier,
      reason: input.reason,
      activeProvider,
      note: `Model tier downgraded from ${input.currentTier} to ${newTier}. This is temporary — the heartbeat loop will attempt to restore the tier.`,
    }
  },
})

export const sendAlert = createTool({
  id: 'sendAlert',
  description: 'Log an alert for persistent failures or critical system issues.',
  inputSchema: z.object({
    severity: z.enum(['info', 'warning', 'critical']).describe('Alert severity'),
    component: z.string().describe('Component that triggered the alert'),
    message: z.string().describe('Alert message'),
    context: z.record(z.unknown()).optional().describe('Additional context'),
  }),
  execute: async (input) => {
    // Log to AgentSession as an alert record
    const session = await prisma.agentSession.create({
      data: {
        agentId: 'healer',
        action: `alert_${input.severity}`,
        input: {
          component: input.component,
          message: input.message,
          context: input.context ?? {},
        },
        output: { alertedAt: new Date().toISOString() },
        status: input.severity === 'critical' ? 'FAILED' : 'SUCCESS',
      },
    })

    return {
      status: 'alert_logged',
      alertId: session.id,
      severity: input.severity,
      component: input.component,
      message: input.message,
      note:
        input.severity === 'critical'
          ? 'CRITICAL alert logged. In production, this would trigger PagerDuty/Slack notifications.'
          : `${input.severity} alert logged for monitoring.`,
    }
  },
})

export const healingTools = {
  retryOperation,
  switchDataSource,
  downgradeModel,
  sendAlert,
}
